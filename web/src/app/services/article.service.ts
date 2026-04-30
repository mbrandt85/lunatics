import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, docData, collectionData, query, orderBy, limit } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { DailyArticle } from '@lunatics/shared';

@Injectable({
  providedIn: 'root'
})
export class ArticleService {
  private firestore = inject(Firestore);

  getTodayArticle(dateStr: string): Observable<DailyArticle> {
    const docRef = doc(this.firestore, `daily_articles/${dateStr}`);
    return docData(docRef) as Observable<DailyArticle>;
  }

  getRecentArticles(n: number = 7): Observable<DailyArticle[]> {
    const colRef = collection(this.firestore, 'daily_articles');
    const q = query(colRef, orderBy('published_at', 'desc'), limit(n));
    return collectionData(q) as Observable<DailyArticle[]>;
  }
}
