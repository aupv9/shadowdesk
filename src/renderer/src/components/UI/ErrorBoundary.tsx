import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  section: string
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 p-8">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <div className="text-center">
            <p className="text-white font-medium mb-1">Something went wrong in {this.props.section}</p>
            <p className="text-sm text-slate-500 font-mono max-w-md break-all">
              {this.state.error?.message}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Section
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
