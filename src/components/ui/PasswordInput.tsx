import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-label="Mostrar senha"
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-7"
        >
          {visible ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
        </button>
      }
    />
  );
}
