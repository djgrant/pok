import type { Lesson } from '../lib/lessons';

interface LessonContentProps {
  lesson: Lesson;
  isComplete: boolean;
  onMarkComplete: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  prevTitle: string | null;
  nextTitle: string | null;
}

export function LessonContent({
  lesson,
  isComplete,
  onMarkComplete,
  onPrevious,
  onNext,
  prevTitle,
  nextTitle,
}: LessonContentProps) {
  return (
    <div className="lesson-content">
      <div className="lesson-body">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: lesson.htmlContent }}
        />
      </div>

      <div className="lesson-footer">
        <div className="lesson-completion">
          <button
            className={`complete-button ${isComplete ? 'completed' : ''}`}
            onClick={onMarkComplete}
          >
            {isComplete ? (
              <>
                <CheckIcon /> Completed
              </>
            ) : (
              'Mark Complete'
            )}
          </button>
        </div>

        <div className="lesson-navigation">
          <button
            className="nav-button prev"
            onClick={onPrevious ?? undefined}
            disabled={!onPrevious}
          >
            <ChevronLeftIcon />
            <span className="nav-label">
              <span className="nav-direction">Previous</span>
              {prevTitle && <span className="nav-title">{prevTitle}</span>}
            </span>
          </button>

          <button
            className="nav-button next"
            onClick={onNext ?? undefined}
            disabled={!onNext}
          >
            <span className="nav-label">
              <span className="nav-direction">Next</span>
              {nextTitle && <span className="nav-title">{nextTitle}</span>}
            </span>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="13 4 6 12 3 9" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="12 15 7 10 12 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 5 13 10 8 15" />
    </svg>
  );
}
