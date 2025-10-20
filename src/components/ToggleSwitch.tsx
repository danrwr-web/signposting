/**
 * Accessible toggle switch component
 */

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  'aria-describedby'?: string
}

export default function ToggleSwitch({ 
  checked, 
  onChange, 
  label, 
  description, 
  disabled = false,
  'aria-describedby': ariaDescribedby 
}: ToggleSwitchProps) {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <label 
          className="text-sm font-medium text-nhs-dark-blue cursor-pointer"
          onClick={handleChange}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-nhs-grey mt-1" id={ariaDescribedby}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${checked ? 'Disable' : 'Enable'} ${label.toLowerCase()}`}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        onClick={handleChange}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2
          ${checked ? 'bg-nhs-green' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}
