import { Children, useState } from 'react';
import { Select } from '@base-ui/react/select';

export default function BloomSelect({ children, value, defaultValue, onChange, name, required, disabled, className='', ...props }) {
  const [trigger, setTrigger] = useState(null);
  const [keyboard, setKeyboard] = useState(false);
  const options = Children.toArray(children).filter(Boolean).map(option => ({
    value: String(option.props.value ?? Children.toArray(option.props.children).join('')),
    label: option.props.children, disabled: option.props.disabled,
  }));
  return <Select.Root name={name} required={required} disabled={disabled} items={options}
    value={value === undefined ? undefined : String(value)} defaultValue={String(defaultValue ?? options[0]?.value ?? '')}
    onValueChange={next => onChange?.({ target: { value: next, name } })}>
    <Select.Trigger {...props} ref={setTrigger} className={`bloom-select-trigger ${className}`} onPointerDown={() => setKeyboard(false)} onKeyDown={() => setKeyboard(true)}>
      <Select.Value /><Select.Icon className="bloom-chevron">⌄</Select.Icon>
    </Select.Trigger>
    <Select.Portal container={trigger?.closest('dialog') || undefined}>
      <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="bloom-positioner">
        <Select.Popup className="bloom-popup bloom-select-popup" data-keyboard={keyboard}>
          <Select.List>{options.map(option => <Select.Item key={option.value} value={option.value} disabled={option.disabled} className="bloom-select-item">
            <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>)}</Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}
