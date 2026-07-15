"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { Error } from "./error"

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Error
          title="Algo deu errado"
          message="Ocorreu um erro inesperado. Por favor, tente novamente."
        />
      )
    }

    return this.props.children
  }
}