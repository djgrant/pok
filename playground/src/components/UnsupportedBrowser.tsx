interface UnsupportedBrowserProps {
  message: string;
}

export function UnsupportedBrowser({ message }: UnsupportedBrowserProps) {
  return (
    <div className="unsupported-browser">
      <h1>Browser Not Supported</h1>
      <p>{message}</p>
      <div className="browsers">
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
          className="browser-link"
        >
          Get Chrome
        </a>
        <a
          href="https://www.mozilla.org/firefox/"
          target="_blank"
          rel="noopener noreferrer"
          className="browser-link"
        >
          Get Firefox
        </a>
      </div>
    </div>
  );
}
