'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MessageSquare, Send } from 'lucide-react';

interface HITLInputRequestProps {
  prompt: string;
  options?: string[];
  onSubmit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}

export function HITLInputRequest({
  prompt,
  options,
  onSubmit,
  onCancel,
  className,
}: HITLInputRequestProps) {
  const [value, setValue] = React.useState('');
  const [selectedOption, setSelectedOption] = React.useState<string | null>(null);

  const handleSubmit = () => {
    const response = options ? selectedOption : value;
    if (response) {
      onSubmit(response);
    }
  };

  const isValid = options ? selectedOption !== null : value.trim().length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Prompt */}
      <div className="flex gap-3">
        <div className="flex items-start justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 shrink-0">
          <MessageSquare className="h-4 w-4 mt-2" />
        </div>
        <div>
          <p className="font-medium text-sm">Agent is asking:</p>
          <p className="text-sm text-muted-foreground mt-1">{prompt}</p>
        </div>
      </div>

      {/* Options or free text */}
      {options && options.length > 0 ? (
        <div className="pl-11">
          <RadioGroup value={selectedOption || ''} onValueChange={setSelectedOption}>
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="text-sm cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ) : (
        <div className="pl-11">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your response..."
            rows={3}
            className="resize-none"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pl-11">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Skip
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
          <Send className="h-4 w-4 mr-1" />
          Send Response
        </Button>
      </div>
    </div>
  );
}
