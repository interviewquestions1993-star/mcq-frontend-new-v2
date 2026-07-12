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
  
  // Timer State
  pendingSubmitIndex: number = -1;
  submitCountdown: number = 0;
  private submitTimerRef: any = null;
  private currentSubmitSubscription: any = null;
  
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
    this.cancelSubmit();

    if (!this.userAnswers[this.currentIndex]?.trim() || !this.currentQuestion) return;

    this.pendingSubmitIndex = this.currentIndex;
    this.submitCountdown = 20;
    this.isSubmitting$.next(true);

    this.submitTimerRef = setInterval(() => {
      this.submitCountdown--;
      if (this.submitCountdown <= 0) {
        this.cancelSubmit(); // Auto cancel if it takes too long
      }
    }, 1000);

    this.currentSubmitSubscription = this.qaService.submitAnswer(
      this.currentQuestion.id,
      this.chapter,
      this.version,
      this.userAnswers[this.currentIndex]
    ).pipe(takeUntil(this.destroy$))
     .subscribe({
        next: (response) => {
          const indexToSubmit = this.currentIndex;
          this.clearSubmitTimer();
          
          this.evaluationResults[indexToSubmit] = response;
          this.isAnswerSubmitted[indexToSubmit] = true;
          
          this.totalMarksAwarded += response.marksAwarded;
          this.totalMaxMarks += response.maxMarks;
          
          this.historyData.push({
            questionId: this.questions[indexToSubmit].id,
            question: this.questions[indexToSubmit].question,
            difficulty: this.questions[indexToSubmit].difficulty,
            userAnswer: this.userAnswers[indexToSubmit],
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
          this.clearSubmitTimer();
        }
      });
  }

  clearSubmitTimer() {
    if (this.submitTimerRef) {
      clearInterval(this.submitTimerRef);
      this.submitTimerRef = null;
    }
    this.pendingSubmitIndex = -1;
    this.currentSubmitSubscription = null;
    this.isSubmitting$.next(false);
  }

  cancelSubmit() {
    if (this.currentSubmitSubscription) {
      this.currentSubmitSubscription.unsubscribe();
    }
    this.clearSubmitTimer();
  }

  previousQuestion() {
    this.cancelSubmit();
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  nextQuestion() {
    this.cancelSubmit();
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    }
  }

  isBatchSubmitting: boolean = false;
  batchCompletedCount: number = 0;
  batchTotalCount: number = 0;
  batchProgressInterval: any;

  submitAllAndFinish() {
    const unsubmittedAnswers: {questionId: number, userAnswer: string}[] = [];
    
    this.questions.forEach((q, i) => {
      if (!this.isAnswerSubmitted[i] && this.userAnswers[i] && this.userAnswers[i].trim()) {
        unsubmittedAnswers.push({
          questionId: q.id,
          userAnswer: this.userAnswers[i].trim()
        });
      }
    });

    if (unsubmittedAnswers.length === 0) {
      this.finishQuiz();
      return;
    }

    this.isBatchSubmitting = true;
    this.batchTotalCount = unsubmittedAnswers.length;
    this.batchCompletedCount = 0;

    // Simulate progress while waiting for the single API response
    // Assuming ~10-15s per question, max concurrent 3, so roughly ~5s per question average throughput
    this.batchProgressInterval = setInterval(() => {
      if (this.batchCompletedCount < this.batchTotalCount - 1) {
        this.batchCompletedCount++;
      }
    }, 5000);

    const examId = "exam_" + new Date().getTime(); // Generate a simple examId if needed

    this.qaService.submitAllAnswers(this.chapter, this.version, unsubmittedAnswers, examId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          clearInterval(this.batchProgressInterval);
          this.batchCompletedCount = this.batchTotalCount;

          if (response && response.success) {
            // Process successful results
            if (response.results) {
              response.results.forEach((res: any) => {
                const idx = this.questions.findIndex(q => q.id === res.questionId);
                if (idx !== -1) {
                  this.evaluationResults[idx] = res;
                  this.isAnswerSubmitted[idx] = true;
                  
                  this.totalMarksAwarded += res.marksAwarded;
                  this.totalMaxMarks += res.maxMarks;
                  
                  this.historyData.push({
                    questionId: res.questionId,
                    question: this.questions[idx].question,
                    difficulty: this.questions[idx].difficulty,
                    userAnswer: this.userAnswers[idx],
                    marksAwarded: res.marksAwarded,
                    maxMarks: res.maxMarks,
                    similarity: res.similarity,
                    keywordCoverage: res.keywordCoverage,
                    feedback: res.feedback,
                    modelAnswer: res.modelAnswer,
                    explanation: res.explanation,
                    page_number: res.page_number,
                    evaluator: res.evaluator,
                    timeTaken: res.evaluationTimeMs || 0
                  });
                }
              });
            }
            
            // Process failed results by adding a dummy evaluation so it shows in the UI
            if (response.failed) {
              response.failed.forEach((fail: any) => {
                const idx = this.questions.findIndex(q => q.id === fail.questionId);
                if (idx !== -1) {
                  this.evaluationResults[idx] = {
                    marksAwarded: 0,
                    maxMarks: this.questions[idx].marks,
                    similarity: 0,
                    keywordCoverage: 0,
                    feedback: `Evaluation Failed: ${fail.error || 'Timeout'}`,
                    missingKeywords: [],
                    evaluator: 'Error',
                    modelAnswer: 'N/A',
                    explanation: 'N/A',
                    page_number: ''
                  };
                  this.isAnswerSubmitted[idx] = true;
                  
                  this.historyData.push({
                    questionId: fail.questionId,
                    question: this.questions[idx].question,
                    difficulty: this.questions[idx].difficulty,
                    userAnswer: this.userAnswers[idx],
                    marksAwarded: 0,
                    maxMarks: this.questions[idx].marks,
                    similarity: 0,
                    keywordCoverage: 0,
                    feedback: `Evaluation Failed: ${fail.error || 'Timeout'}`,
                    modelAnswer: 'N/A',
                    explanation: 'N/A',
                    page_number: '',
                    evaluator: 'Error',
                    timeTaken: 0,
                    failed: true
                  });
                }
              });
            }
          }

          setTimeout(() => {
            this.isBatchSubmitting = false;
            this.finishQuiz();
          }, 1000);
        },
        error: (err) => {
          clearInterval(this.batchProgressInterval);
          console.error('Failed to evaluate batch', err);
          this.isBatchSubmitting = false;
          // Optionally still finish the quiz or show error
          alert('Batch evaluation failed completely. Moving to results.');
          this.finishQuiz();
        }
      });
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
        feedback: this.userAnswers[i]?.trim() ? 'Not evaluated' : 'Not submitted',
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
