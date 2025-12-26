interface SidebarProps {
  selectedLesson: string | null;
  onSelectLesson: (lessonId: string) => void;
}

interface Lesson {
  id: string;
  number: number;
  title: string;
}

// Static placeholder lessons for now
const lessons: Lesson[] = [
  { id: 'intro', number: 1, title: 'Introduction to pok' },
  { id: 'commands', number: 2, title: 'Creating Commands' },
  { id: 'tasks', number: 3, title: 'Working with Tasks' },
  { id: 'events', number: 4, title: 'Event System' },
  { id: 'environments', number: 5, title: 'Environments' },
  { id: 'checks', number: 6, title: 'Checks & Validation' },
];

export function Sidebar({
  selectedLesson,
  onSelectLesson,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>pok</h1>
        <p>Interactive CLI Tutorial</p>
      </header>
      <nav className="sidebar-content">
        <ul className="lesson-list">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className={`lesson-item ${selectedLesson === lesson.id ? 'active' : ''}`}
              onClick={() => onSelectLesson(lesson.id)}
            >
              <span className="lesson-number">{lesson.number}.</span>
              {lesson.title}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
