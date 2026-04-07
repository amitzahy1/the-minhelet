"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center" dir="rtl">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">אופס, משהו השתבש</h2>
          <p className="text-gray-500 mb-4">נסו לרענן את הדף</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-6 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
          >
            רענן דף
          </button>
          {this.state.error && (
            <details className="mt-4 text-start max-w-md">
              <summary className="text-sm text-gray-400 cursor-pointer">פרטי שגיאה טכניים</summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-auto" dir="ltr">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
