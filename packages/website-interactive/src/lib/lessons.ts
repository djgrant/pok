import { marked } from 'marked';

export interface LessonFrontmatter {
  title: string;
  order: number;
  category: 'getting-started' | 'core-concepts';
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  order: number;
  category: LessonFrontmatter['category'];
  content: string;
  htmlContent: string;
}

export interface LessonCategory {
  id: LessonFrontmatter['category'];
  title: string;
  lessons: Lesson[];
}

const CATEGORY_TITLES: Record<LessonFrontmatter['category'], string> = {
  'getting-started': 'Getting Started',
  'core-concepts': 'Core Concepts',
};

const CATEGORY_ORDER: LessonFrontmatter['category'][] = ['getting-started', 'core-concepts'];

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: LessonFrontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid frontmatter format');
  }

  const [, frontmatterStr, body] = match;
  const frontmatter: Record<string, string | number> = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: string | number = line.slice(colonIndex + 1).trim();
      // Parse numbers
      if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter: frontmatter as unknown as LessonFrontmatter,
    body: body.trim(),
  };
}

/**
 * Configure marked for rendering
 */
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Load all lessons from the lessons directory using Vite's glob import
 */
export function loadLessons(lessonModules: Record<string, string>): LessonCategory[] {
  const lessons: Lesson[] = [];

  for (const [path, content] of Object.entries(lessonModules)) {
    // Extract slug from path: ./01-first-command.md -> 01-first-command
    const slug = path.replace(/^.*\//, '').replace(/\.md$/, '');
    const id = slug;

    try {
      const { frontmatter, body } = parseFrontmatter(content);
      const htmlContent = marked.parse(body) as string;

      lessons.push({
        id,
        slug,
        title: frontmatter.title,
        order: frontmatter.order,
        category: frontmatter.category,
        content: body,
        htmlContent,
      });
    } catch (error) {
      console.error(`Failed to parse lesson ${path}:`, error);
    }
  }

  // Group lessons by category
  const categoryMap = new Map<LessonFrontmatter['category'], Lesson[]>();

  for (const lesson of lessons) {
    const existing = categoryMap.get(lesson.category) || [];
    existing.push(lesson);
    categoryMap.set(lesson.category, existing);
  }

  // Sort lessons within each category and build result
  const categories: LessonCategory[] = [];

  for (const categoryId of CATEGORY_ORDER) {
    const categoryLessons = categoryMap.get(categoryId);
    if (categoryLessons && categoryLessons.length > 0) {
      categoryLessons.sort((a, b) => a.order - b.order);
      categories.push({
        id: categoryId,
        title: CATEGORY_TITLES[categoryId],
        lessons: categoryLessons,
      });
    }
  }

  return categories;
}

/**
 * Get a flat list of all lessons in order
 */
export function getAllLessonsFlat(categories: LessonCategory[]): Lesson[] {
  return categories.flatMap((cat) => cat.lessons);
}

/**
 * Find lesson by ID
 */
export function findLessonById(categories: LessonCategory[], id: string): Lesson | undefined {
  for (const category of categories) {
    const lesson = category.lessons.find((l) => l.id === id);
    if (lesson) return lesson;
  }
  return undefined;
}

/**
 * Get next and previous lessons
 */
export function getAdjacentLessons(
  categories: LessonCategory[],
  currentId: string
): { prev: Lesson | null; next: Lesson | null } {
  const allLessons = getAllLessonsFlat(categories);
  const currentIndex = allLessons.findIndex((l) => l.id === currentId);

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
    next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
  };
}
