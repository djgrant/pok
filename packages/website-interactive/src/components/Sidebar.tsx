import type { LessonCategory } from '../lib/lessons';

interface SidebarProps {
  categories: LessonCategory[];
  selectedLesson: string | null;
  onSelectLesson: (lessonId: string) => void;
  isComplete: (lessonId: string) => boolean;
}

export function Sidebar({
  categories,
  selectedLesson,
  onSelectLesson,
  isComplete,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>pok</h1>
        <p>Interactive CLI Tutorial</p>
      </header>
      <nav className="sidebar-content">
        {categories.map((category) => (
          <div key={category.id} className="lesson-category">
            <h2 className="category-title">{category.title}</h2>
            <ul className="lesson-list">
              {category.lessons.map((lesson, index) => (
                <li
                  key={lesson.id}
                  className={`lesson-item ${selectedLesson === lesson.id ? 'active' : ''}`}
                  onClick={() => onSelectLesson(lesson.id)}
                >
                  <span className="lesson-status">
                    {isComplete(lesson.id) ? (
                      <CheckIcon />
                    ) : (
                      <span className="lesson-number">{index + 1}</span>
                    )}
                  </span>
                  <span className="lesson-title">{lesson.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function CheckIcon() {
  return (
    <svg
      className="check-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="11 4 5.5 10 3 7.5" />
    </svg>
  );
}
