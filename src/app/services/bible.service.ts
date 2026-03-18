import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface VerseData {
  id: string;
  ref: string;
  verseNumber: number;
  bookCode: string;
  bookName: string;
  versions: Record<string, string>;
}

export interface BibleVersionOption {
  key: string;
  label: string;
}

export interface BibleBookOption {
  code: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class BibleService {
  readonly currentVerses = signal<VerseData[]>([]);
  readonly isLoading = signal(false);

  private readonly apiToken = environment.bibleApiToken;

  readonly versionOptions: BibleVersionOption[] = [
    { key: 'nvi', label: 'NVI' },
    { key: 'acf', label: 'ACF' },
    { key: 'ra', label: 'RA' },
    { key: 'kja', label: 'KJA' },
    { key: 'kjv', label: 'KJV' },
    { key: 'bbe', label: 'BBE' }
  ];

  readonly bookOptions: BibleBookOption[] = [
    { code: 'GEN', name: 'Gênesis' },
    { code: 'EXO', name: 'Êxodo' },
    { code: 'LEV', name: 'Levítico' },
    { code: 'NUM', name: 'Números' },
    { code: 'DEU', name: 'Deuteronômio' },
    { code: 'JOS', name: 'Josué' },
    { code: 'JDG', name: 'Juízes' },
    { code: 'RUT', name: 'Rute' },
    { code: '1SA', name: '1 Samuel' },
    { code: '2SA', name: '2 Samuel' },
    { code: '1KI', name: '1 Reis' },
    { code: '2KI', name: '2 Reis' },
    { code: 'PSA', name: 'Salmos' },
    { code: 'PRO', name: 'Provérbios' },
    { code: 'ISA', name: 'Isaías' },
    { code: 'MAT', name: 'Mateus' },
    { code: 'MAR', name: 'Marcos' },
    { code: 'LUK', name: 'Lucas' },
    { code: 'JHN', name: 'João' },
    { code: 'ACT', name: 'Atos' },
    { code: 'ROM', name: 'Romanos' },
    { code: '1CO', name: '1 Coríntios' },
    { code: 'REV', name: 'Apocalipse' }
  ];

  private readonly bookMap: Record<string, string> = {
    GEN: 'gn',
    EXO: 'ex',
    LEV: 'lv',
    NUM: 'nm',
    DEU: 'dt',
    JOS: 'js',
    JDG: 'jz',
    RUT: 'rt',
    '1SA': '1sm',
    '2SA': '2sm',
    '1KI': '1rs',
    '2KI': '2rs',
    '1CH': '1cr',
    '2CH': '2cr',
    EZR: 'ed',
    NEH: 'ne',
    EST: 'et',
    JOB: 'job',
    PSA: 'sl',
    PRO: 'pv',
    ECC: 'ec',
    SNG: 'ct',
    ISA: 'is',
    JER: 'jr',
    LAM: 'lm',
    EZK: 'ez',
    DAN: 'dn',
    HOS: 'os',
    JOL: 'jl',
    AMO: 'am',
    OBA: 'ob',
    JON: 'jn',
    MIC: 'mq',
    NAH: 'na',
    HAB: 'hc',
    ZEP: 'sf',
    HAG: 'ag',
    ZEC: 'zc',
    MAL: 'ml',
    MAT: 'mt',
    MAR: 'mc',
    LUK: 'lc',
    JHN: 'jo',
    ACT: 'at',
    ROM: 'rm',
    '1CO': '1co',
    '2CO': '2co',
    GAL: 'gl',
    EPH: 'ef',
    PHP: 'fp',
    COL: 'cl',
    '1TH': '1ts',
    '2TH': '2ts',
    '1TI': '1tm',
    '2TI': '2tm',
    TIT: 'tt',
    PHM: 'fm',
    HEB: 'hb',
    JAM: 'tg',
    '1PE': '1pe',
    '2PE': '2pe',
    '1JO': '1jo',
    '2JO': '2jo',
    '3JO': '3jo',
    JUD: 'jd',
    REV: 'ap'
  };

  private readonly bookNames: Record<string, string> = {
    GEN: 'Gênesis',
    EXO: 'Êxodo',
    LEV: 'Levítico',
    NUM: 'Números',
    DEU: 'Deuteronômio',
    JOS: 'Josué',
    JDG: 'Juízes',
    RUT: 'Rute',
    '1SA': '1 Samuel',
    '2SA': '2 Samuel',
    '1KI': '1 Reis',
    '2KI': '2 Reis',
    PSA: 'Salmos',
    PRO: 'Provérbios',
    ISA: 'Isaías',
    MAT: 'Mateus',
    MAR: 'Marcos',
    LUK: 'Lucas',
    JHN: 'João',
    ACT: 'Atos',
    ROM: 'Romanos',
    '1CO': '1 Coríntios',
    REV: 'Apocalipse'
  };

  async loadPassage(bookCode: string, chapter: number): Promise<void> {
    this.isLoading.set(true);
    try {
      const verses = await this.fetchPassage(bookCode, chapter);
      this.currentVerses.set(verses);
    } catch (error) {
      console.error('Failed to load bible data', error);
      this.currentVerses.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchPassage(bookCode: string, chapter: number): Promise<VerseData[]> {
    const abbrev = this.bookMap[bookCode] || 'gn';

    const [nvi, acf, ra, kja, kjv, bbe] = await Promise.all([
      this.fetchApi(abbrev, chapter, 'nvi'),
      this.fetchApi(abbrev, chapter, 'acf'),
      this.fetchApi(abbrev, chapter, 'ra'),
      this.fetchApi(abbrev, chapter, 'kja'),
      this.fetchApi(abbrev, chapter, 'kjv'),
      this.fetchApi(abbrev, chapter, 'bbe')
    ]);

    let length = Math.max(nvi.length || 0, acf.length || 0, ra.length || 0, kja.length || 0, kjv.length || 0, bbe.length || 0);

    let usingFallback = false;
    if (length === 0 && bookCode === 'GEN' && chapter === 1) {
      length = 3;
      usingFallback = true;
      console.warn('API rate limit or failure. Using fallback data for Genesis 1.');
    }

    const verses: VerseData[] = [];

    for (let i = 0; i < length; i += 1) {
      const verseNum = i + 1;

      const getText = (source: Array<{ number: number; text: string }>, versionKey: string): string => {
        if (usingFallback) {
          return this.getFallbackText(versionKey, verseNum);
        }

        const verse = source.find((item) => item.number === verseNum);
        return verse ? verse.text.trim() : '';
      };

      verses.push({
        id: `${abbrev}-${chapter}-${verseNum}`,
        ref: `${chapter}:${verseNum}`,
        verseNumber: verseNum,
        bookCode,
        bookName: this.bookNames[bookCode] || bookCode,
        versions: {
          nvi: getText(nvi, 'nvi'),
          acf: getText(acf, 'acf'),
          ra: getText(ra, 'ra'),
          kja: getText(kja, 'kja'),
          kjv: getText(kjv, 'kjv'),
          bbe: getText(bbe, 'bbe')
        }
      });
    }

    return verses;
  }

  private async fetchApi(bookAbbrev: string, chapter: number, version: string): Promise<Array<{ number: number; text: string }>> {
    if (!this.apiToken) {
      return [];
    }

    try {
      const response = await fetch(`https://www.abibliadigital.com.br/api/verses/${version}/${bookAbbrev}/${chapter}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { verses?: Array<{ number: number; text: string }> };
      return data.verses || [];
    } catch {
      return [];
    }
  }

  private getFallbackText(version: string, verse: number): string {
    const db: Record<number, Record<string, string>> = {
      1: {
        nvi: 'No princípio Deus criou os céus e a terra.',
        acf: 'No princípio criou Deus os céus e a terra.',
        ra: 'No princípio criou Deus os céus e a terra.',
        kja: 'No princípio criou Deus os céus e a terra.',
        kjv: 'In the beginning God created the heaven and the earth.',
        bbe: 'At the first God made the heaven and the earth.'
      },
      2: {
        nvi: 'Era a terra sem forma e vazia; trevas cobriam a face do abismo, e o Espírito de Deus se movia sobre a face das águas.',
        acf: 'E a terra era sem forma e vazia; e havia trevas sobre a face do abismo; e o Espírito de Deus se movia sobre a face das águas.',
        ra: 'A terra, porém, estava sem forma e vazia; havia trevas sobre a face do abismo, e o Espírito de Deus pairava por sobre as águas.',
        kja: 'A terra, entretanto, era sem forma e vazia; havia trevas sobre a face do abismo, e o Espírito de Deus pairava sobre as águas.',
        kjv: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.',
        bbe: 'And the earth was waste and without form; and it was dark on the face of the deep: and the Spirit of God was moving on the face of the waters.'
      },
      3: {
        nvi: 'Disse Deus: "Haja luz", e houve luz.',
        acf: 'E disse Deus: Haja luz; e houve luz.',
        ra: 'Disse Deus: Haja luz; e houve luz.',
        kja: 'Disse Deus: "Haja luz!", e houve luz.',
        kjv: 'And God said, Let there be light: and there was light.',
        bbe: 'And God said, Let there be light: and there was light.'
      }
    };

    return db[verse]?.[version] || '(Texto indisponível via API)';
  }
}
