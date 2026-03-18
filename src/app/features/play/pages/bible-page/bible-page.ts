import { NgFor, NgIf } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { BibleService, VerseData } from '../../../../services/bible.service';

@Component({
  selector: 'app-bible-page',
  imports: [NgIf, NgFor],
  templateUrl: './bible-page.html',
  styleUrl: './bible-page.css'
})
export class BiblePage {
  private readonly bibleService = inject(BibleService);

  readonly selectedVersion = signal('nvi');
  readonly selectedBook = signal('GEN');
  readonly selectedChapter = signal(1);

  readonly verses = this.bibleService.currentVerses;
  readonly loading = this.bibleService.isLoading;
  readonly versions = this.bibleService.versionOptions;
  readonly books = this.bibleService.bookOptions;

  readonly chapterLabel = computed(() => `${this.selectedBook()} ${this.selectedChapter()}`);

  constructor() {
    void this.loadPassage();
  }

  async onBookChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement | null;
    const bookCode = target?.value?.trim();
    if (!bookCode) {
      return;
    }

    this.selectedBook.set(bookCode);
    this.selectedChapter.set(1);
    await this.loadPassage();
  }

  async onChapterInput(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement | null;
    const chapter = Number(target?.value);
    if (!Number.isInteger(chapter) || chapter < 1) {
      return;
    }

    this.selectedChapter.set(chapter);
    await this.loadPassage();
  }

  async onPrevChapter(): Promise<void> {
    const previous = Math.max(1, this.selectedChapter() - 1);
    this.selectedChapter.set(previous);
    await this.loadPassage();
  }

  async onNextChapter(): Promise<void> {
    this.selectedChapter.set(this.selectedChapter() + 1);
    await this.loadPassage();
  }

  onVersionChange(version: string): void {
    if (!version) {
      return;
    }

    this.selectedVersion.set(version);
  }

  getVerseText(verse: VerseData): string {
    const text = verse.versions[this.selectedVersion()];
    return text?.trim() || '(Texto indisponível nessa versão.)';
  }

  private async loadPassage(): Promise<void> {
    await this.bibleService.loadPassage(this.selectedBook(), this.selectedChapter());
  }
}
