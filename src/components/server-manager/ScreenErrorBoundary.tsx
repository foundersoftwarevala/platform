import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Used as a reset key: changing it clears the error state. */
  screenId: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  screenId: string;
}

/**
 * Per-screen error boundary. Without this, a failed render in any Server
 * Manager screen unmounts the whole dashboard shell.
 */
class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, screenId: props.screenId };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.screenId !== state.screenId) {
      return { error: null, screenId: props.screenId };
    }
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[server-manager] screen crashed', {
      screen: this.props.screenId,
      error,
      componentStack: info.componentStack,
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-10 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">This screen failed to load</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {this.state.error.message || 'An unexpected error occurred while rendering this view.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ScreenErrorBoundary;
