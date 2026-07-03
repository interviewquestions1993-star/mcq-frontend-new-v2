import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatChipsModule } from "@angular/material/chips";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatBadgeModule } from "@angular/material/badge";
import { MatTooltipModule } from "@angular/material/tooltip";
import { QAService, StudyQuestion } from "../../services/qa.service";
import { BehaviorSubject, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-study",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatBadgeModule,
    MatTooltipModule,
  ],
  templateUrl: "./study.component.html",
  styleUrls: ["./study.component.css"],
})
export class StudyComponent implements OnInit, OnDestroy {
  topic = "";
  allQuestions: StudyQuestion[] = [];
  filteredQuestions: StudyQuestion[] = [];

  isLoading$ = new BehaviorSubject<boolean>(true);
  hasError = false;
  errorMessage = "";

  // Filters
  searchText = "";
  filterDifficulty = "";
  filterMarks: number | "" = "";

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private qaService: QAService
  ) {}

  ngOnInit() {
    this.topic = this.route.snapshot.paramMap.get("topic") || "";
    this.loadQuestions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuestions() {
    this.isLoading$.next(true);
    this.hasError = false;
    this.qaService
      .getStudyQuestions(this.topic)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === "chapter_not_available") {
            this.hasError = true;
            this.errorMessage = response.message || "Chapter not available.";
            this.isLoading$.next(false);
            return;
          }
          this.allQuestions = response.questions || [];
          this.applyFilters();
          this.isLoading$.next(false);
        },
        error: (err) => {
          console.error("Failed to load study questions", err);
          this.hasError = true;
          this.errorMessage = "Could not connect to the server. Please make sure the backend is running.";
          this.isLoading$.next(false);
        },
      });
  }

  applyFilters() {
    let qs = [...this.allQuestions];

    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      qs = qs.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          (item.keywords || []).some((kw) => kw.toLowerCase().includes(q))
      );
    }

    if (this.filterDifficulty) {
      qs = qs.filter(
        (item) => item.difficulty.toLowerCase() === this.filterDifficulty.toLowerCase()
      );
    }

    if (this.filterMarks !== "") {
      qs = qs.filter((item) => item.marks === +this.filterMarks);
    }

    this.filteredQuestions = qs;
  }

  clearFilters() {
    this.searchText = "";
    this.filterDifficulty = "";
    this.filterMarks = "";
    this.applyFilters();
  }

  get uniqueMarks(): number[] {
    const marks = [...new Set(this.allQuestions.map((q) => q.marks))].sort(
      (a, b) => a - b
    );
    return marks;
  }

  get uniqueDifficulties(): string[] {
    return [...new Set(this.allQuestions.map((q) => q.difficulty))];
  }

  difficultyStars(difficulty: string): string {
    const map: { [key: string]: string } = {
      easy: "⭐",
      medium: "⭐⭐",
      hard: "⭐⭐⭐",
    };
    return map[difficulty?.toLowerCase()] || "⭐";
  }

  difficultyClass(difficulty: string): string {
    const map: { [key: string]: string } = {
      easy: "badge-easy",
      medium: "badge-medium",
      hard: "badge-hard",
    };
    return map[difficulty?.toLowerCase()] || "badge-medium";
  }

  goBack() {
    this.router.navigate(["/"]);
  }

  get topicDisplay(): string {
    if (!this.topic) return "";
    const parts = this.topic.split(":");
    return parts.length > 1 ? parts[parts.length - 1].trim() : this.topic;
  }
}
