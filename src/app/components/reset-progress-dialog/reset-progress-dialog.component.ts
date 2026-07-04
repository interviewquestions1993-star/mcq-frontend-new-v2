import { Component } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-progress-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Reset Chapter Progress</h2>
    <mat-dialog-content>
      <p>Are you sure you want to reset your question progress for this chapter?</p>
      <p style="color: #666; font-size: 0.9em; margin-top: 12px;">
        This will <strong>NOT</strong> delete:
      </p>
      <ul style="color: #666; font-size: 0.9em; margin-bottom: 0;">
        <li>Quiz History</li>
        <li>Scores</li>
        <li>Analytics</li>
      </ul>
      <p style="color: #666; font-size: 0.9em; margin-top: 12px;">
        It will ONLY clear your question progress so you can practice again.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="warn" (click)="onReset()">Reset</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 300px;
    }
  `]
})
export class ResetProgressDialogComponent {
  constructor(public dialogRef: MatDialogRef<ResetProgressDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onReset(): void {
    this.dialogRef.close(true);
  }
}
