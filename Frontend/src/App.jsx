import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import prism from 'prismjs'
import "prismjs/themes/prism-tomorrow.css"
import "prismjs/components/prism-javascript"
import Editor from "react-simple-code-editor"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"
import axios from 'axios'
import * as acorn from 'acorn'
import './App.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-banner" style={{ margin: '1rem' }}>
          <span className="error-icon">⚠️</span>
          <div>
            <strong>Something went wrong rendering feedback.</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
              {this.state.error?.message || 'A UI rendering error occurred.'}
            </p>
            <button 
              className="btn btn-outline btn-sm" 
              style={{ marginTop: '0.5rem' }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

const DEFAULT_CODE = '';

function extractErrorLinesFromReview(reviewText) {
  if (!reviewText) return [];
  const matches = [...reviewText.matchAll(/(?:line|lines|Line|Lines)\s*:?\s*(\d+)/gi)];
  return [...new Set(matches.map(m => parseInt(m[1], 10)).filter(num => num > 0))];
}

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [review, setReview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [syntaxError, setSyntaxError] = useState(null);

  const aiFlaggedLines = extractErrorLinesFromReview(review);

  useEffect(() => {
    prism.highlightAll();
    checkSyntax('');
  }, []);

  function checkSyntax(currentCode) {
    if (!currentCode.trim()) {
      setSyntaxError(null);
      return;
    }
    try {
      acorn.parse(currentCode, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowHashBang: true
      });
      setSyntaxError(null);
    } catch (err) {
      if (err && err.loc) {
        setSyntaxError({
          line: err.loc.line,
          column: err.loc.column,
          pos: err.pos || 0,
          message: err.message ? err.message.replace(/\s*\(\d+:\d+\)$/, '') : 'Syntax error'
        });
      } else {
        setSyntaxError(null);
      }
    }
  }

  function highlightCode(inputCode) {
    const lines = inputCode.split('\n');
    return lines.map((lineText, idx) => {
      const lineNum = idx + 1;
      const isSyntaxErr = syntaxError && syntaxError.line === lineNum;
      const isAiFlagged = aiFlaggedLines.includes(lineNum);
      const lineHtml = prism.highlight(lineText || ' ', prism.languages.javascript, 'javascript');

      if (isSyntaxErr || isAiFlagged) {
        const errorType = isSyntaxErr ? 'Syntax Error' : 'AI Review Flagged';
        return `<span class="editor-line-error" title="${errorType} on Line ${lineNum}">${lineHtml}</span>`;
      }
      return lineHtml;
    }).join('\n');
  }

  function handleClearCode() {
    setCode('');
    setReview('');
    setError(null);
    setSyntaxError(null);
  }

  function handleCodeChange(newCode) {
    setCode(newCode);
    checkSyntax(newCode);
    if (!newCode.trim()) {
      setReview('');
      setError(null);
    }
  }

  function jumpToError() {
    if (!syntaxError) return;
    const textarea = document.querySelector('.editor-container textarea');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(syntaxError.pos, syntaxError.pos);
    }
  }

  async function reviewCode() {
    if (!code.trim() || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setReview('');

    try {
      const response = await axios.post('http://localhost:3000/ai/get-review', { code });
      
      if (response.data && response.data.success) {
        setReview(response.data.review);
      } else {
        const errorText = response.data?.error || 'The AI service did not return a review. Please try again.';
        setError(errorText);
      }
    } catch (err) {
      console.error('API Error:', err);
      const isNetworkError = err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response;
      const errMsg = err.response?.data?.error || (isNetworkError ? 'The AI service is not responsive. Check your backend server or network connection.' : err.message) || 'Failed to fetch code review. Is the backend server running?';
      setError(errMsg);
      setReview('');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    if (!review) return;
    navigator.clipboard.writeText(review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      reviewCode();
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-title">AI Powered Code Reviewer</span>
          <span className="brand-badge">
            <span className="badge-dot"></span> 
          </span>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-outline" 
            onClick={handleClearCode} 
            title="Clear code editor"
          >
            <span>🗑️</span> Clear Editor
          </button>
          <button 
            className="btn btn-primary" 
            onClick={reviewCode} 
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
                Analyzing...
              </>
            ) : (
              <>
                <span>✨</span> Review Code
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Left Code Editor Panel */}
        <div className="panel left-panel">
          <div className="panel-header">
            <span className="panel-title">
              <span>💻</span> Code Editor
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {code.split('\n').length} lines • {code.length} chars • Press Ctrl+Enter to review
            </span>
          </div>

          <div className="panel-body editor-container" onKeyDown={handleKeyDown}>
            <div className="code-editor-wrapper">
              <div className="line-numbers" aria-hidden="true">
                {code.split('\n').map((_, i) => {
                  const lineNum = i + 1;
                  const isSyntaxErr = syntaxError && syntaxError.line === lineNum;
                  const isAiFlagged = aiFlaggedLines.includes(lineNum);
                  
                  return (
                    <span 
                      key={i} 
                      className={`line-number ${isSyntaxErr ? 'has-error' : isAiFlagged ? 'has-warning' : ''}`}
                      title={isSyntaxErr ? `Syntax Error: ${syntaxError.message}` : isAiFlagged ? `AI Feedback on line ${lineNum}` : ''}
                    >
                      {isSyntaxErr ? '❌' : isAiFlagged ? '⚠️' : lineNum}
                    </span>
                  );
                })}
              </div>
              <div className="editor-inner">
                <Editor
                  value={code}
                  onValueChange={handleCodeChange}
                  highlight={highlightCode}
                  padding={16}
                  style={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: 15
                  }}
                />

                {syntaxError && (
                  <div className="syntax-error-bar" onClick={jumpToError} title="Click to move cursor to error position">
                    <span className="error-badge">⚠️ Syntax Error</span>
                    <span className="error-location">Line {syntaxError.line}, Col {syntaxError.column + 1}: {syntaxError.message}</span>
                    <button type="button" className="btn btn-outline btn-xs" onClick={jumpToError}>
                      🎯 Jump to Cursor Point
                    </button>
                  </div>
                )}

                <div className="editor-footer">
                  <button 
                    className="btn btn-primary" 
                    onClick={reviewCode} 
                    disabled={isLoading || !code.trim()}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
                        Reviewing...
                      </>
                    ) : (
                      <>
                        <span>🚀</span> Review Code
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Review Results Panel */}
        <div className="panel right-panel">
          <div className="panel-header">
            <span className="panel-title">
              <span>🔍</span> Feedback & Suggestions
            </span>
            {review && !isLoading && (
              <button className="btn btn-outline" onClick={handleCopy} title="Copy Markdown review">
                {copied ? '✅ Copied!' : '📋 Copy Review'}
              </button>
            )}
          </div>

          <div className="panel-body">
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <div>
                  <strong>Review Failed</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>{error}</p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Analyzing code structure, quality, security, and performance...</p>
              </div>
            ) : review ? (
              <div className="markdown-body">
                <ErrorBoundary key={review}>
                  <Markdown rehypePlugins={[rehypeHighlight]}>
                    {review}
                  </Markdown>
                </ErrorBoundary>
              </div>
            ) : !error ? (
              <div className="empty-state">
                <span className="empty-icon">💡</span>
                <span className="empty-title">Ready for Code Review</span>
                <span className="empty-sub">
                  Paste or write code in the editor on the left and click <strong>Review Code</strong> to receive senior-level feedback.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
