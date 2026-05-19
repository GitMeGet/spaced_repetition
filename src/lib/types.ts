export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export type CardType = 'mcq' | 'reveal';

export type ImageBlurRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type McqCard = {
  id?: number;
  cardType?: CardType;
  sourceSet?: string;
  sourceQuestion?: number;
  question: string;
  answers: string[];
  correctIndex: number;
  imageBase64?: string;
  imageSrc?: string;
  answerImageSrc?: string;
  note?: string;
  hidden?: boolean;
  hiddenAt?: string;
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
  cardType?: CardType;
  sourceSet?: string;
  sourceQuestion?: number;
  question: string;
  answers: string[];
  correctIndex: number;
  imageBase64?: string;
  imageSrc?: string;
  answerImageSrc?: string;
  questionImageBase64?: string;
  image?: string;
};

export type StudyGrade = 'again' | 'good';
