import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SurgeryProvider, useSurgery } from '../SurgeryContext'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: ''
})

// Test component that uses the surgery context
function TestComponent() {
  const { surgery, setSurgery, clearSurgery } = useSurgery()
  
  return (
    <div>
      <div data-testid="surgery-name">{surgery?.name || 'No surgery'}</div>
      <div data-testid="surgery-id">{surgery?.id || 'No ID'}</div>
      <button 
        onClick={() => setSurgery({ id: 'test-id', name: 'Test Surgery' })}
        data-testid="set-surgery"
      >
        Set Surgery
      </button>
      <button 
        onClick={clearSurgery}
        data-testid="clear-surgery"
      >
        Clear Surgery
      </button>
    </div>
  )
}

describe('SurgeryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    document.cookie = ''
  })

  it('should provide initial surgery state', () => {
    const initialSurgery = { id: 'initial-id', name: 'Initial Surgery' }
    
    render(
      <SurgeryProvider initialSurgery={initialSurgery}>
        <TestComponent />
      </SurgeryProvider>
    )

    expect(screen.getByTestId('surgery-name')).toHaveTextContent('Initial Surgery')
    expect(screen.getByTestId('surgery-id')).toHaveTextContent('initial-id')
  })

  it('should provide null initial state when no surgery provided', () => {
    render(
      <SurgeryProvider initialSurgery={null}>
        <TestComponent />
      </SurgeryProvider>
    )

    expect(screen.getByTestId('surgery-name')).toHaveTextContent('No surgery')
    expect(screen.getByTestId('surgery-id')).toHaveTextContent('No ID')
  })

  it('should set surgery and update URL/cookie/localStorage', async () => {
    const user = userEvent.setup()
    
    render(
      <SurgeryProvider initialSurgery={null}>
        <TestComponent />
      </SurgeryProvider>
    )

    await user.click(screen.getByTestId('set-surgery'))

    expect(screen.getByTestId('surgery-name')).toHaveTextContent('Test Surgery')
    expect(screen.getByTestId('surgery-id')).toHaveTextContent('test-id')
    
    // Check that cookie was set
    expect(document.cookie).toContain('surgery=test-id')
    
    // Check that localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'surgery_state',
      JSON.stringify({ id: 'test-id', name: 'Test Surgery' })
    )
    
    // Check that URL was updated
    expect(mockPush).toHaveBeenCalledWith('/?surgery=test-id')
  })

  it('should clear surgery and remove URL/cookie/localStorage', async () => {
    const user = userEvent.setup()
    const initialSurgery = { id: 'initial-id', name: 'Initial Surgery' }
    
    render(
      <SurgeryProvider initialSurgery={initialSurgery}>
        <TestComponent />
      </SurgeryProvider>
    )

    await user.click(screen.getByTestId('clear-surgery'))

    expect(screen.getByTestId('surgery-name')).toHaveTextContent('No surgery')
    expect(screen.getByTestId('surgery-id')).toHaveTextContent('No ID')
    
    // Check that cookie was removed
    expect(document.cookie).toContain('surgery=;')
    
    // Check that localStorage was cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('surgery_state')
    
    // Check that URL was updated
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('should throw error when useSurgery is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useSurgery must be used within a SurgeryProvider')
    
    consoleSpy.mockRestore()
  })

  it('should handle localStorage precedence on mount', async () => {
    const storedSurgery = { id: 'stored-id', name: 'Stored Surgery' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSurgery))
    
    render(
      <SurgeryProvider initialSurgery={null}>
        <TestComponent />
      </SurgeryProvider>
    )

    // Wait for useEffect to run
    await waitFor(() => {
      expect(screen.getByTestId('surgery-name')).toHaveTextContent('Stored Surgery')
    })
  })

  it('should handle cookie precedence on mount', async () => {
    document.cookie = 'surgery=cookie-id; Path=/'
    const storedSurgery = { id: 'cookie-id', name: 'Cookie Surgery' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSurgery))
    
    render(
      <SurgeryProvider initialSurgery={null}>
        <TestComponent />
      </SurgeryProvider>
    )

    // Wait for useEffect to run
    await waitFor(() => {
      expect(screen.getByTestId('surgery-name')).toHaveTextContent('Cookie Surgery')
    })
  })
})

