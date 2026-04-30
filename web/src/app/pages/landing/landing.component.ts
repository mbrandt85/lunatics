import { Component, inject, signal, effect, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { ArticleService } from '../../services/article.service';
import { DailyArticle } from '@lunatics/shared';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, take } from 'rxjs/operators';
import { BehaviorSubject, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MatProgressBarModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule
  ],
  template: `
    <mat-toolbar class="nav-toolbar">
      <button mat-icon-button (click)="changeDay(-1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      
      <div class="date-picker-container">
        <div style="position: relative; display: flex; align-items: center;">
          <input matInput [matDatepicker]="picker" [value]="selectedDate()" [max]="maxDate" (dateChange)="onDateChange($event.value)" 
                 style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;">
          <button mat-button (click)="picker.open()" class="date-display">
            {{ selectedDate() | date:'MMM d' }}
            <mat-icon>calendar_today</mat-icon>
          </button>
        </div>
        <mat-datepicker #picker></mat-datepicker>
      </div>

      <button mat-icon-button (click)="changeDay(1)" [disabled]="isToday()">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </mat-toolbar>

    <div class="container" *ngIf="article(); else loading">
      <article class="article-content">
        <header class="article-header">
          <div class="published-date">
            {{ ($any(article()?.published_at)?.toDate ? $any(article()?.published_at).toDate() : article()?.published_at) | date:'EEEE' }}
          </div>
          <h1 class="title">{{ article()?.title }}</h1>
          <p class="lede">{{ article()?.lede }}</p>
        </header>
        
        <div class="vibe-section" *ngIf="article()?.vibe_tonight">
          <div class="vibe-header">
            <mat-icon>nights_stay</mat-icon>
            <h3>Tonight's Vibe</h3>
          </div>
          <p class="vibe-text">{{ article()?.vibe_tonight }}</p>
          <div class="context-tag" *ngIf="article()?.context">
            <mat-icon>event</mat-icon> {{ article()?.context }}
          </div>
        </div>

        <div class="main-body" [innerHTML]="article()?.body"></div>

        <section class="stats-section">
          <h2>Detailed Insights</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="label">Violent Crimes</span>
              <span class="value">{{ article()?.stats_snapshot?.total_crimes }}</span>
            </div>
            <div class="stat-card">
              <span class="label">Moon Phase</span>
              <span class="value">{{ article()?.stats_snapshot?.moon_phase }}</span>
            </div>
            <div class="stat-card">
              <span class="label">Anomaly Score</span>
              <span class="value">{{ article()?.stats_snapshot?.deviation_score | number:'1.1-2' }}</span>
            </div>
          </div>
          
          <div class="risk-meter">
            <div class="risk-label">
              <span>Risk Level</span>
              <span>{{ (article()?.risk_level || 0) * 10 }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="(article()?.risk_level || 0) * 10"></mat-progress-bar>
          </div>
        </section>
      </article>
    </div>

    <ng-template #loading>
      <div class="loading-spinner">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <p>Analyzing lunar patterns...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .nav-toolbar {
      background: var(--mat-sys-surface) !important;
      display: grid;
      grid-template-columns: 50px 1fr 50px;
      align-items: center;
      justify-items: center;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      height: 64px;
      padding: 0 0.5rem;
    }
    .date-picker-container {
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .date-display {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--mat-sys-primary);
    }
    .container {
      padding: 2rem 1rem;
      max-width: 800px;
      margin: 0 auto;
    }
    .article-header {
      margin-bottom: 3rem;
    }
    .published-date {
      color: var(--mat-sys-secondary);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 1px;
      margin-bottom: 0.5rem;
    }
    .title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 1.5rem 0;
      color: var(--mat-sys-on-surface);
    }
    .lede {
      font-size: 1.25rem;
      line-height: 1.6;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 2rem;
    }
    .vibe-section {
      background: var(--mat-sys-surface-container-low);
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 3rem;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .vibe-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      color: var(--mat-sys-primary);
    }
    .vibe-header h3 { margin: 0; font-family: 'Outfit', sans-serif; }
    .vibe-text { font-size: 1.1rem; line-height: 1.6; color: var(--mat-sys-on-surface); }
    .main-body {
      font-size: 1.1rem;
      line-height: 1.8;
      color: var(--mat-sys-on-surface);
      margin-bottom: 4rem;
    }
    .main-body ::ng-deep a {
      color: var(--mat-sys-primary);
      text-decoration: underline;
    }
    .stats-section h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: var(--mat-sys-on-surface);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .stat-card {
      background: var(--mat-sys-surface-container);
      padding: 1.25rem;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-card .label { color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    .stat-card .value { color: var(--mat-sys-on-surface); font-weight: 600; font-size: 1.1rem; }
    
    .risk-meter { margin-top: 2rem; }
    .risk-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant);
    }
    
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vh;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (min-width: 600px) {
      .title { font-size: 3rem; }
      .stats-grid { grid-template-columns: repeat(3, 1fr); }
      .stat-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `]
})
export class LandingComponent {
  private articleService = inject(ArticleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  selectedDate = signal<Date>(new Date());
  maxDate = new Date();
  
  private dateSubject = new BehaviorSubject<string | null>(null);
  article: Signal<DailyArticle | null>;
  
  constructor() {
    // 1. Sync Route with State
    this.route.paramMap.subscribe(params => {
      const dateStr = params.get('date');
      if (dateStr) {
        const date = new Date(dateStr);
        // Prevent future dates via URL
        if (date > this.maxDate) {
          this.navigateToDate(this.maxDate);
          return;
        }
        this.selectedDate.set(date);
        this.dateSubject.next(dateStr);
      } else {
        // Default: Use TODAY
        const todayStr = this.maxDate.toISOString().split('T')[0];
        this.selectedDate.set(new Date(this.maxDate));
        this.dateSubject.next(todayStr);
      }
    });

    // 2. Fetch Article based on dateSubject
    this.article = toSignal(
      this.dateSubject.pipe(
        switchMap(date => date ? this.articleService.getTodayArticle(date) : of(null))
      ),
      { initialValue: null }
    );
  }

  isToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const selected = this.selectedDate().toISOString().split('T')[0];
    return today === selected;
  }

  changeDay(delta: number) {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + delta);
    this.navigateToDate(next);
  }

  onDateChange(date: Date | null) {
    if (date) this.navigateToDate(date);
  }

  private navigateToDate(date: Date) {
    // Cap at today
    const finalDate = date > this.maxDate ? this.maxDate : date;
    const dateStr = finalDate.toISOString().split('T')[0];
    this.router.navigate([dateStr]);
  }
}
