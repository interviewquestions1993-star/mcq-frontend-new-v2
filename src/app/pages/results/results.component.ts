import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { QAService } from '../../services/qa.service';

interface QuizResults {
  topic: string;
  score: number;
  total: number;
  percentage: number;
  answers: { [key: number]: string };
  questions: any[];
  type?: string;
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent implements OnInit {
  results: QuizResults | null = null;
  isQA = false;
  chapter: string = '';
  version: string = '';
  retryingId: number | null = null;

  constructor(private router: Router, private qaService: QAService) {}

  ngOnInit() {
    const resultsStr = sessionStorage.getItem('quizResults');
    if (resultsStr) {
      this.results = JSON.parse(resultsStr);
      this.isQA = this.results?.type === 'qa';
      
      if (this.isQA && this.results?.topic) {
        const match = this.results.topic.match(/:\s*(.+)-(MCQ|QA)-(v\d+)$/i);
        if (match) {
          this.chapter = match[1].trim();
          this.version = match[3].toUpperCase();
        }
      }

      if (this.results && (!Number.isFinite(this.results.percentage) || this.results.percentage < 0 || this.results.percentage > 100)) {
        this.results.percentage = this.calculatePercentage(this.results.score, this.results.total);
      }
    }
  }

  retryEvaluation(q: any) {
    if (!this.chapter || !this.version) return;
    this.retryingId = q.questionId;
    
    this.qaService.submitAnswer(q.questionId, this.chapter, this.version, q.userAnswer).subscribe({
      next: (res) => {
        this.retryingId = null;
        if (res && this.results) {
          q.failed = false;
          q.marksAwarded = res.marksAwarded;
          q.similarity = res.similarity;
          q.keywordCoverage = res.keywordCoverage;
          q.feedback = res.feedback;
          q.evaluator = res.evaluator;
          q.modelAnswer = res.modelAnswer;
          q.explanation = res.explanation;
          q.page_number = res.page_number;
          
          // Re-calculate totals
          this.results.score = this.results.questions.reduce((sum, q) => sum + (q.marksAwarded || 0), 0);
          this.results.percentage = this.calculatePercentage(this.results.score, this.results.total);
          sessionStorage.setItem('quizResults', JSON.stringify(this.results));
        }
      },
      error: (err) => {
        this.retryingId = null;
        alert('Retry failed again. Please try later.');
      }
    });
  }

  private calculatePercentage(score: number, total: number): number {
    return total > 0 ? Math.round((score / total) * 100) : 0;
  }

  getGrade(percentage: number): string {
    if (percentage >= 60) return 'pass';
    return 'fail';
  }

  getTitleByGrade(grade: string): string {
    const titles: { [key: string]: string } = {
      pass: 'Great Job!',
      fail: 'Keep Practicing'
    };
    return titles[grade] || 'Complete!';
  }

  getFeedback(percentage: number): string {
    if (percentage >= 60) return 'Great job! You have a strong understanding of this topic.';
    return 'Keep practicing! This topic needs more focus.';
  }

  goHome() {
    sessionStorage.removeItem('quizResults');
    this.router.navigate(['/']);
  }

  retakeQuiz() {
    if (this.results) {
      sessionStorage.removeItem('quizResults');
      this.router.navigate(['/quiz', this.results.topic]);
    }
  }

  saveAsPDF() {
    window.print();
  }

  private normalizeAnswer(answer: string | null | undefined): string {
    return String(answer || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\.\)]/g, '')
      .toUpperCase();
  }

  private normalizeOptionText(text: string): string {
    return String(text || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\.\)]/g, '')
      .toUpperCase();
  }

  private getOptionLetterForText(question: any, answerText: string): string | null {
    const normalizedAnswer = this.normalizeAnswer(answerText);
    if (!normalizedAnswer) return null;
    for (let i = 0; i < question.options.length; i++) {
      const optionLabel = String.fromCharCode(65 + i);
      const optionText = this.normalizeOptionText(question.options[i]);
      if (
        normalizedAnswer === optionText ||
        normalizedAnswer === optionLabel ||
        optionText.includes(normalizedAnswer) ||
        normalizedAnswer.includes(optionText)
      ) {
        return optionLabel;
      }
    }
    return null;
  }

  isCorrectAnswer(question: any): boolean {
    if (!this.results) return false;
    const answerKey = question.localId || question.id;
    const selectedRaw = this.results.answers?.[answerKey] || null;
    const selected = this.normalizeAnswer(selectedRaw);
    const correctRaw = question.correct_answer || '';
    const correctText = this.normalizeAnswer(correctRaw);
    const correctLetter = this.getOptionLetterForText(question, correctRaw);
    if (selected && correctLetter && selected.charAt(0) === correctLetter) return true;
    if (selected && correctText && selected === correctText) return true;
    const selectedText = selected ? this.normalizeOptionText(selectedRaw || '') : '';
    if (selectedText && correctText && selectedText === correctText) return true;
    return false;
  }

  getAnswerLabelWithText(question: any, answer: string | null): string | null {
    if (!answer) return null;
    const trimmed = answer.trim();
    const firstChar = trimmed[0]?.toUpperCase();
    if (firstChar && /^[A-D]$/.test(firstChar) && trimmed.length === 1) {
      const index = firstChar.charCodeAt(0) - 65;
      const optionText = question?.options?.[index];
      if (optionText) return `${firstChar}. ${optionText}`;
    }
    if (question?.options) {
      const answerLower = trimmed.toLowerCase();
      for (let i = 0; i < question.options.length; i++) {
        const optionLower = question.options[i].toLowerCase();
        if (optionLower === answerLower || optionLower.includes(answerLower) || answerLower.includes(optionLower)) {
          const letter = String.fromCharCode(65 + i);
          return `${letter}. ${question.options[i]}`;
        }
      }
    }
    return trimmed;
  }
}
