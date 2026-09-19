import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

/** 出错兜底：任何渲染异常都不该变成一片白屏，直接把原因摊在页面上。 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    return (
      <div className="mx-auto max-w-3xl p-6 font-mono text-[13px] leading-relaxed">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="mb-2 text-[15px] font-semibold">界面渲染失败</p>
          <p className="whitespace-pre-wrap break-all">{err.message}</p>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[12px] opacity-80">
            {err.stack}
          </pre>
          <button
            className="mt-3 cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-[13px]"
            onClick={() => location.reload()}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
