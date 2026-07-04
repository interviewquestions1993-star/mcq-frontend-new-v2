import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProgressInfo {
  board: string;
  class: string;
  subject: string;
  chapter: string;
  version: string;
  questionType: string;
  totalQuestions: number;
  attemptedQuestions: number;
  remainingQuestions: number;
  percentageCompleted: number;
  completed: boolean;
  lastAttemptAt?: string;
}

export interface ProgressResetRequest {
  board: string;
  class: string;
  subject: string;
  chapter: string;
  version: string;
  questionType: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  constructor(private http: HttpClient) {}

  private getBaseUrl(): string {
    return (window as any).__API_URL__ || 'https://mcq-backend-new-v2.onrender.com';
  }

  getProgress(
    board: string,
    classNum: string,
    subject: string,
    chapter: string,
    version: string,
    questionType: string
  ): Observable<ProgressInfo> {
    const url = `${this.getBaseUrl()}/api/progress`;
    let params = new HttpParams()
      .set('board', board)
      .set('class', classNum)
      .set('subject', subject)
      .set('chapter', chapter)
      .set('version', version)
      .set('questionType', questionType);

    return this.http.get<ProgressInfo>(url, { params });
  }

  resetProgress(request: ProgressResetRequest): Observable<any> {
    const url = `${this.getBaseUrl()}/api/progress/reset`;
    return this.http.post(url, request);
  }
}
