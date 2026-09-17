import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = error?.message || '';
    if (
      msg.includes('Database is closing') ||
      msg.includes('closing/hidden') ||
      msg.includes('connection is closing')
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in LooseBudget app:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Something went wrong</h2>
              <p className="text-xs text-gray-400 mt-1">An unexpected error occurred while rendering this section.</p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/50 border border-white/5 rounded-xl text-left overflow-auto max-h-24">
                <p className="text-[10px] font-mono text-rose-300 break-words">{this.state.error.message}</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
              >
                <RefreshCw size={14} /> Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
