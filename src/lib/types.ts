export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type McqCard = {
  id?: number;
  sourceSet?: string;
  sourceQuestion?: number;
  question: string;
  answers: string[];
  correctIndex: number;
  imageBase64?: string;
  due: string;
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  state: CardState;
  createdAt: string;
  updatedAt: string;
};

export type ImportCard = {
  sourceSet?: string;
  sourceQuestion?: number;
  question: string;
  answers: string[];
  correctIndex: number;
  imageBase64?: string;
  questionImageBase64?: string;
  image?: string;
};

export type StudyGrade = 'again' | 'good';
