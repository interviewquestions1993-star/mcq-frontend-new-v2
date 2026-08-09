import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  constructor(private http: HttpClient) {}

  private getBaseUrl(): string {
    return (window as any).__API_URL__ || 'https://mcq-backend-new-v2.onrender.com';
  }

  sendEmailResults(resultsData: any): Observable<any> {
    const apiUrl = `${this.getBaseUrl()}/api/email/results`;
    return this.http.post(apiUrl, resultsData);
  }
}
