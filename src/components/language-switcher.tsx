import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, changeLanguage, t } = useLanguage();

  const languages = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'hi', label: 'हिंदी', nativeLabel: 'हिंदी' },
    { code: 'de', label: 'Deutsch', nativeLabel: 'Deutsch' },
  ];

  const currentLanguage = languages.find((l) => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Globe className="w-4 h-4 mr-2" />
          {currentLanguage?.label || 'EN'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={language === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">
              {language === lang.code && '✓'}
            </span>
            {lang.nativeLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Inline language switcher (radio buttons)
 */
export function LanguageSwitcherInline() {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <div className="flex gap-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="language"
          value="en"
          checked={language === 'en'}
          onChange={(e) => changeLanguage(e.target.value)}
          className="w-4 h-4"
        />
        <span className="text-sm">English</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="language"
          value="hi"
          checked={language === 'hi'}
          onChange={(e) => changeLanguage(e.target.value)}
          className="w-4 h-4"
        />
        <span className="text-sm">हिंदी</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="language"
          value="de"
          checked={language === 'de'}
          onChange={(e) => changeLanguage(e.target.value)}
          className="w-4 h-4"
        />
        <span className="text-sm">Deutsch</span>
      </label>
    </div>
  );
}
