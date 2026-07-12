import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QAQuestion {
  id: number;
  question: string;
  difficulty: string;
  marks: number;
  expected_word_count?: {
    min: number;
    max: number;
  };
  page_number?: string;
}

export interface QAResponse {
  topic: string;
  num_questions: number;
  questions: QAQuestion[];
  status: string;
  message?: string;
}

export interface QAEvaluateResponse {
  marksAwarded: number;
  maxMarks: number;
  similarity: number;
  keywordCoverage: number;
  feedback: string;
  missingKeywords: string[];
  evaluator?: string;
  modelAnswer: string;
  explanation?: string;
  page_number?: string;
}

export interface QAHistoryRecord {
  quizType: string;
  chapter: string;
  version: string;
  questions: any[];
  totalMarks: number;
  maximumMarks: number;
  percentage: number;
  completedAt?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

export interface StudyQuestion {
  id: number;
  question: string;
  answer: string;
  difficulty: string;
  marks: number;
  expected_word_count?: { min: number; max: number };
  keywords: string[];
  explanation?: string;
  page_number?: string;
  question_type?: string;
}

export interface StudyResponse {
  topic: string;
  num_questions: number;
  questions: StudyQuestion[];
  status: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class QAService {
  constructor(private http: HttpClient) {}

  private getBaseUrl(): string {
    return (window as any).__API_URL__ || 'https://mcq-backend-new-v2.onrender.com';
  }

  getQuestions(payload: any): Observable<QAResponse> {
    const apiUrl = `${this.getBaseUrl()}/api/mcq/cbse`;
    return this.http.post<QAResponse>(apiUrl, payload);
  }

  submitAnswer(questionId: number, chapter: string, version: string, userAnswer: string): Observable<QAEvaluateResponse> {
    const apiUrl = `${this.getBaseUrl()}/api/qa/submit-answer`;
    return this.http.post<QAEvaluateResponse>(apiUrl, {
      questionId,
      chapter,
      version,
      userAnswer
    });
  }

  submitAllAnswers(chapter: string, version: string, answers: {questionId: number, userAnswer: string}[], examId?: string): Observable<any> {
    const apiUrl = `${this.getBaseUrl()}/api/qa/evaluate-batch`;
    return this.http.post<any>(apiUrl, {
      examId,
      chapter,
      version,
      answers
    });
  }

  saveHistory(record: QAHistoryRecord): Observable<any> {
    const apiUrl = `${this.getBaseUrl()}/api/qa/history`;
    return this.http.post(apiUrl, record);
  }

  getStudyQuestions(topic: string): Observable<StudyResponse> {
    const apiUrl = `${this.getBaseUrl()}/api/study/questions`;
    return this.http.post<StudyResponse>(apiUrl, { topic, num_questions: -1 });
  }
}
