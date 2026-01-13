import { App } from 'obsidian';
import { WorkflowConfig, AIToolboxSettings } from '../settings';
import { videoPlatformRegistry } from './video-platforms';
import { generateFilenameTimestamp } from '../utils/date-utils';
import {
    OutputHandler,
    OutputContext,
    NewNoteOutputHandler,
    AtCursorOutputHandler,
    PopupOutputHandler
} from '../handlers';
import {
    WorkflowExecutionResult,
    WorkflowResultsMap,
    detectCircularDependency,
    hasWorkflowDependencies,
    getDependencyWorkflowIds,
    gatherContextValues,
    ContextTokenValues
} from './workflow-chaining';
import {
    ActionExecutionResult,
    ActionResultsMap,
    ActionExecutionContext,
    executeAction
} from './action-executor';
import { logInfo, logNotice, LogCategory } from '../logging';

/**
 * Create an output handler based on the workflow's output type.
 */
function createOutputHandler(outputType: string): OutputHandler {
    switch (outputType) {
        case 'new-note':
            return new NewNoteOutputHandler();
        case 'at-cursor':
            return new AtCursorOutputHandler();
        case 'popup':
        default:
            return new PopupOutputHandler();
    }
}

/**
 * Generate a note title based on the final action result.
 */
function generateNoteTitle(result: ActionExecutionResult, workflowName: string): string {
    const timestamp = generateFilenameTimestamp();

    if (result.actionType === 'transcription' && result.metadata?.inputResult) {
        const inputResult = result.metadata.inputResult;
        if (inputResult.sourceUrl) {
            const handler = videoPlatformRegistry.findHandlerForUrl(inputResult.sourceUrl);
            const metadata = inputResult.metadata;

            if (handler?.platformId === 'tiktok') {
                const author = metadata?.uploader || 'Unknown';
                return `TikTok by ${author} - ${timestamp}`;
            }

            if (handler?.platformId === 'youtube') {
                const title = metadata?.title || 'Video';
                const author = metadata?.uploader || 'Unknown';
                return `${title} - ${author} - ${timestamp}`;
            }
        }
    }

    return `${workflowName} - ${timestamp}`;
}

/**
 * Get the final output text from action results.
 * Uses the response token from the last action.
 */
function getFinalOutputText(lastResult: ActionExecutionResult): string {
    if (lastResult.actionType === 'chat') {
        return lastResult.tokens['response'] || '';
    } else if (lastResult.actionType === 'transcription') {
        // For transcription, prefer timestamped version if available
        const timestamped = lastResult.tokens['transcriptionWithTimestamps'];
        if (timestamped) {
            return timestamped;
        }
        return lastResult.tokens['transcription'] || '';
    } else {
        // For http-request, return the response body
        return lastResult.tokens['responseBody'] || '';
    }
}

/**
 * Recursively execute workflow dependencies and collect their results.
 * Handles circular dependency detection and proper execution order.
 */
async function executeDependencies(
    app: App,
    settings: AIToolboxSettings,
    workflow: WorkflowConfig,
    results: WorkflowResultsMap,
    executionStack: Set<string>
): Promise<boolean> {
    const dependencyIds = getDependencyWorkflowIds(workflow);

    for (const depId of dependencyIds) {
        if (results.has(depId)) {
            continue;
        }

        if (executionStack.has(depId)) {
            const depWorkflow = settings.workflows.find(w => w.id === depId);
            logNotice(LogCategory.WORKFLOW, `Circular dependency detected: "${depWorkflow?.name ?? depId}" is already being executed.`);
            return false;
        }

        const depWorkflow = settings.workflows.find(w => w.id === depId);
        if (!depWorkflow) {
            logNotice(LogCategory.WORKFLOW, `Dependency workflow not found: ${depId}`);
            return false;
        }

        executionStack.add(depId);

        if (hasWorkflowDependencies(depWorkflow)) {
            const depSuccess = await executeDependencies(app, settings, depWorkflow, results, executionStack);
            if (!depSuccess) {
                return false;
            }
        }

        logNotice(LogCategory.WORKFLOW, `Executing dependency: ${depWorkflow.name}...`);
        const result = await executeWorkflowInternal(app, settings, depWorkflow, results);

        if (!result.success) {
            logNotice(LogCategory.WORKFLOW, `Dependency workflow "${depWorkflow.name}" failed: ${result.error}`);
            return false;
        }

        results.set(depId, result);
        executionStack.delete(depId);
    }

    return true;
}

/**
 * Execute a workflow by running all its actions sequentially.
 * Each action receives the accumulated results from previous actions.
 *
 * @param app - Obsidian App instance
 * @param settings - Plugin settings
 * @param workflow - The workflow configuration to execute
 */
export async function executeWorkflow(
    app: App,
    settings: AIToolboxSettings,
    workflow: WorkflowConfig
): Promise<void> {
    logInfo(LogCategory.WORKFLOW, `Starting workflow: ${workflow.name}`, { id: workflow.id, actionCount: workflow.actions.length });

    if (workflow.actions.length === 0) {
        logNotice(LogCategory.WORKFLOW, `Workflow "${workflow.name}" has no actions. Please add actions in settings.`);
        return;
    }

    // Check for circular dependencies before starting
    if (hasWorkflowDependencies(workflow)) {
        const cycle = detectCircularDependency(workflow, settings);
        if (cycle.length > 0) {
            logNotice(LogCategory.WORKFLOW, `Circular dependency detected: ${cycle.join(' → ')}`);
            return;
        }
    }

    // Execute all dependencies first
    const dependencyResults: WorkflowResultsMap = new Map();
    if (hasWorkflowDependencies(workflow)) {
        const executionStack = new Set<string>();
        executionStack.add(workflow.id);

        const dependenciesSuccess = await executeDependencies(
            app, settings, workflow, dependencyResults, executionStack
        );

        if (!dependenciesSuccess) {
            return;
        }
    }

    // Convert dependency results to ActionExecutionResult format
    const dependencyActionResults: ActionResultsMap = new Map();
    for (const [workflowId, result] of dependencyResults) {
        dependencyActionResults.set(workflowId, {
            actionId: workflowId,
            actionType: result.workflowType,
            success: result.success,
            error: result.error,
            tokens: result.tokens
        });
    }

    // Gather workflow context values once at the start (clipboard, selection, etc.)
    const workflowContext: ContextTokenValues = await gatherContextValues(app);

    // Execute actions sequentially
    const actionResults: ActionResultsMap = new Map();
    let lastResult: ActionExecutionResult | null = null;

    logNotice(LogCategory.WORKFLOW, `Executing workflow: ${workflow.name}...`);

    for (const action of workflow.actions) {
        const context: ActionExecutionContext = {
            app,
            settings,
            previousResults: actionResults,
            dependencyResults: dependencyActionResults,
            workflowName: workflow.name,
            workflowContext
        };

        const result = await executeAction(action, context);

        if (!result.success) {
            logNotice(LogCategory.WORKFLOW, `Action "${action.name}" failed: ${result.error}`);
            return;
        }

        actionResults.set(action.id, result);
        lastResult = result;
    }

    if (!lastResult) {
        return;
    }

    logInfo(LogCategory.WORKFLOW, `Workflow completed: ${workflow.name}`);

    // Handle output
    const outputText = getFinalOutputText(lastResult);
    const noteTitle = generateNoteTitle(lastResult, workflow.name);

    const outputType = workflow.outputType || 'popup';
    const handler = createOutputHandler(outputType);
    const context: OutputContext = {
        app,
        workflow,
        noteTitle
    };

    await handler.handleOutput(outputText, context);
}

/**
 * Internal workflow execution that returns a result for chaining.
 * Used when executing workflows as dependencies.
 */
async function executeWorkflowInternal(
    app: App,
    settings: AIToolboxSettings,
    workflow: WorkflowConfig,
    _dependencyResults: WorkflowResultsMap
): Promise<WorkflowExecutionResult> {
    const baseResult: WorkflowExecutionResult = {
        workflowId: workflow.id,
        workflowType: 'chat',
        success: false,
        tokens: {}
    };

    if (workflow.actions.length === 0) {
        return { ...baseResult, error: 'No actions configured' };
    }

    // Gather workflow context values once at the start
    const workflowContext: ContextTokenValues = await gatherContextValues(app);

    // Execute actions sequentially
    const actionResults: ActionResultsMap = new Map();

    for (const action of workflow.actions) {
        const context: ActionExecutionContext = {
            app,
            settings,
            previousResults: actionResults,
            dependencyResults: new Map(),
            workflowName: workflow.name,
            workflowContext
        };

        const result = await executeAction(action, context);

        if (!result.success) {
            return { ...baseResult, error: result.error };
        }

        actionResults.set(action.id, result);
    }

    // Get the last action's result
    const lastAction = workflow.actions[workflow.actions.length - 1];
    if (!lastAction) {
        return { ...baseResult, error: 'No actions configured' };
    }
    const lastResult = actionResults.get(lastAction.id);

    if (!lastResult) {
        return { ...baseResult, error: 'No result from last action' };
    }

    return {
        workflowId: workflow.id,
        workflowType: lastResult.actionType,
        success: true,
        tokens: lastResult.tokens
    };
}
