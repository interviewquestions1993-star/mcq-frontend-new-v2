import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { QAService, QAQuestion, QAEvaluateResponse, QAHistoryRecord } from '../../services/qa.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-qa-quiz',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './qa-quiz.component.html',
  styleUrls: ['./qa-quiz.component.css']
})
export class QaQuizComponent implements OnInit, OnDestroy {
  topic: string = '';
  chapter: string = '';
  version: string = '';
  questionCount: number = 10;
  
  questions: QAQuestion[] = [];
  currentIndex: number = 0;
  userAnswers: string[] = [];
  
  isLoading$ = new BehaviorSubject<boolean>(true);
  isSubmitting$ = new BehaviorSubject<boolean>(false);
  
  // Evaluation state
  isAnswerSubmitted: boolean[] = [];
  evaluationResults: (QAEvaluateResponse | null)[] = [];
  error: string = '';

  // History tracking
  historyData: any[] = [];
  totalMarksAwarded: number = 0;
  totalMaxMarks: number = 0;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private qaService: QAService
  ) {}

  get currentQuestion(): QAQuestion | null {
    if (this.questions.length > 0 && this.currentIndex < this.questions.length) {
      return this.questions[this.currentIndex];
    }
    return null;
  }

  get progress(): number {
    if (this.questions.length === 0) return 0;
    return ((this.currentIndex) / this.questions.length) * 100;
  }

  ngOnInit() {
    this.topic = this.route.snapshot.paramMap.get('topic') || '';
    
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.questionCount = params['count'] ? +params['count'] : 10;
      // We will parse chapter and version from the topic string for internal state
      // Topic format: CBSE Class X Subject: Chapter-TYPE-VERSION
      const match = this.topic.match(/:\s*(.+)-(MCQ|QA)-(v\d+)$/i);
      if (match) {
        this.chapter = match[1].trim();
        this.version = match[3].toUpperCase();
      }
      this.loadQuestions();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goHome() {
    this.router.navigate(['/']);
  }

  loadQuestions() {
    this.isLoading$.next(true);
    
    const payload = {
      topic: this.topic,
      num_questions: this.questionCount
    };
    
    this.qaService.getQuestions(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.status === 'completed' || response.completed === true) {
            this.error = response.message || 'Congratulations! You have attempted all questions for this chapter.';
            this.isLoading$.next(false);
            return;
          }
          if (response.status === 'chapter_not_available') {
            this.error = response.message || 'This chapter is not yet available.';
            this.isLoading$.next(false);
            return;
          }
          this.questions = response.questions || [];
          this.userAnswers = new Array(this.questions.length).fill('');
          this.isAnswerSubmitted = new Array(this.questions.length).fill(false);
          this.evaluationResults = new Array(this.questions.length).fill(null);
          this.isLoading$.next(false);
        },
        error: (err) => {
          console.error('Failed to load questions', err);
          this.error = 'Failed to load questions. Please try again.';
          this.isLoading$.next(false);
        }
      });
  }

  submitAnswer() {
    if (!this.userAnswers[this.currentIndex]?.trim() || !this.currentQuestion) return;
    
    this.isSubmitting$.next(true);
    
    this.qaService.submitAnswer(
      this.currentQuestion.id,
      this.chapter,
      this.version,
      this.userAnswers[this.currentIndex]
    ).pipe(takeUntil(this.destroy$))
     .subscribe({
        next: (response) => {
          this.evaluationResults[this.currentIndex] = response;
          this.isAnswerSubmitted[this.currentIndex] = true;
          this.isSubmitting$.next(false);
          
          this.totalMarksAwarded += response.marksAwarded;
          this.totalMaxMarks += response.maxMarks;
          
          this.historyData.push({
            questionId: this.currentQuestion!.id,
            question: this.currentQuestion!.question,
            difficulty: this.currentQuestion!.difficulty,
            userAnswer: this.userAnswers[this.currentIndex],
            marksAwarded: response.marksAwarded,
            maxMarks: response.maxMarks,
            similarity: response.similarity,
            keywordCoverage: response.keywordCoverage,
            feedback: response.feedback,
            modelAnswer: response.modelAnswer,
            explanation: response.explanation,
            page_number: response.page_number,
            evaluator: response.evaluator,
            timeTaken: 0
          });
        },
        error: (err) => {
          console.error('Failed to evaluate answer', err);
          this.isSubmitting$.next(false);
        }
      });
  }

  previousQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    }
  }

  finishQuiz() {
    // If finished early, slice the questions to only include the ones seen so far
    if (this.currentIndex < this.questions.length - 1) {
      this.questions = this.questions.slice(0, this.currentIndex + 1);
    }

    // Build unanswered question entries so every question appears in results
    const allQuestionsData = this.questions.map((q, i) => {
      const submitted = this.historyData.find(h => h.questionId === q.id);
      if (submitted) return submitted;
      return {
        questionId: q.id,
        question: q.question,
        difficulty: q.difficulty,
        userAnswer: this.userAnswers[i] || '',
        marksAwarded: 0,
        maxMarks: q.marks,
        similarity: 0,
        keywordCoverage: 0,
        feedback: 'Not submitted',
        modelAnswer: '',
        explanation: '',
        page_number: q.page_number || '',
        evaluator: ''
      };
    });

    const finalTotalMaxMarks = allQuestionsData.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
    const finalMarksAwarded = allQuestionsData.reduce((sum, q) => sum + (q.marksAwarded || 0), 0);
    const percentage = finalTotalMaxMarks > 0
      ? (finalMarksAwarded / finalTotalMaxMarks) * 100
      : 0;

    const record: QAHistoryRecord = {
      quizType: 'qa',
      chapter: this.chapter,
      version: this.version,
      questions: allQuestionsData,
      totalMarks: finalMarksAwarded,
      maximumMarks: finalTotalMaxMarks,
      percentage: Math.round(percentage),
      completedAt: new Date().toISOString()
    };



    // Store rich results in sessionStorage for results page
    const qaResults = {
      type: 'qa',
      topic: this.topic,
      score: finalMarksAwarded,
      total: finalTotalMaxMarks,
      percentage: Math.round(percentage),
      questions: allQuestionsData
    };
    sessionStorage.setItem('quizResults', JSON.stringify(qaResults));

    const navigate = () => {
      this.router.navigate(['/results']);
    };

    this.qaService.saveHistory(record).subscribe({
      next: () => navigate(),
      error: (err: any) => {
        console.error('Failed to save history', err);
        navigate();
      }
    });
  }
}
