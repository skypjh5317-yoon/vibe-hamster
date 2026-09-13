import { useRef, useState } from 'react'
import {
  connectToHamster,
  disconnectFromHamster,
  type HamsterBluetoothCharacteristic,
  type HamsterConnection,
} from './services/bluetoothService'
import './App.css'

const exampleCommands = [
  '앞으로 30cm',
  '뒤로 20cm',
  '오른쪽으로 90도 돌아',
  '왼쪽으로 90도 돌아',
  '멈춰',
]

function App() {
  const [command, setCommand] = useState('')
  const [status, setStatus] = useState('대기 중')
  const [lastCommand, setLastCommand] = useState('-')
  const [connection, setConnection] = useState<HamsterConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [bluetoothError, setBluetoothError] = useState('')
  const characteristicRef = useRef<HamsterBluetoothCharacteristic | null>(null)

  const handleRunCommand = () => {
    const trimmedCommand = command.trim()

    if (!trimmedCommand) {
      setStatus('명령을 입력해 주세요')
      return
    }

    setLastCommand(trimmedCommand)
    setStatus('명령을 준비했어요')
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setBluetoothError('')

    try {
      const nextConnection = await connectToHamster()
      setConnection(nextConnection)
      characteristicRef.current = nextConnection.characteristic
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        setBluetoothError('Bluetooth 연결이 취소되었습니다.')
      } else if (error instanceof Error) {
        setBluetoothError(error.message)
      } else {
        setBluetoothError('햄스터-S에 연결할 수 없습니다.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    if (connection) {
      disconnectFromHamster(connection.device)
    }

    setConnection(null)
    characteristicRef.current = null
    setBluetoothError('')
  }

  const sendTestPacket = async (leftSpeed: number, rightSpeed: number) => {
  const characteristic = characteristicRef.current

  if (!characteristic) {
    setBluetoothError('먼저 햄스터를 연결해주세요.')
    return
  }

  const packet = new Uint8Array([
    0x00,
    0x00,
    0x10,
    leftSpeed,
    rightSpeed,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ])

  const uuid = characteristic.uuid
  const properties = Object.entries(characteristic.properties)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(', ')

  const hex = Array.from(packet)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(' ')

  console.log('🐹 ===== Hamster-S WRITE TEST =====')
  console.log('Characteristic UUID:', uuid)
  console.log('Properties:', properties)
  console.log('Packet length:', packet.length)
  console.log('Packet HEX:', hex)
  console.log('Left speed:', leftSpeed)
  console.log('Right speed:', rightSpeed)

  // 태블릿 화면에서도 테스트 정보를 확인할 수 있도록 표시
  setStatus(
    `전송 중...\nUUID: ${uuid}\nProperties: ${properties}\n길이: ${packet.length} bytes\nHEX: ${hex}`,
  )

  try {
    await characteristic.writeValueWithoutResponse(packet)

    console.log('🐹 WRITE SUCCESS')

    setStatus(
      `✅ WRITE SUCCESS\nUUID: ${uuid}\n길이: ${packet.length} bytes\nHEX: ${hex}`,
    )
  } catch (error) {
    console.error('🐹 WRITE FAILED:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'packet 전송에 실패했습니다.'

    setBluetoothError(errorMessage)

    setStatus(
      `❌ WRITE FAILED\nUUID: ${uuid}\n오류: ${errorMessage}`,
    )
  }
}

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">🤖</div>
        <div>
          <p className="eyebrow">HAMSTER-S PLAYGROUND</p>
          <h1>AI 햄스터</h1>
          <p className="subtitle">말로 명령하면 햄스터가 움직여요!</p>
        </div>
      </header>

      <section className="connection-card" aria-label="햄스터 연결 상태">
        <div className="connection-copy">
          <span className={`status-dot ${connection ? 'is-connected' : ''}`} aria-hidden="true" />
          <div>
            <p className="card-label">Bluetooth 상태</p>
            <strong>{connection ? `🐹 ${connection.deviceName} 연결됨` : '햄스터 연결 안 됨'}</strong>
          </div>
        </div>
        {connection ? (
          <button type="button" className="secondary-button disconnect-button" onClick={handleDisconnect}>
            <span aria-hidden="true">⛓️‍💥</span> 연결 해제
          </button>
        ) : (
          <button type="button" className="secondary-button" onClick={handleConnect} disabled={isConnecting}>
            <span aria-hidden="true">🔗</span> {isConnecting ? '연결하는 중...' : '햄스터 연결하기'}
          </button>
        )}
      </section>

      {bluetoothError && (
        <p className="bluetooth-error" role="alert">⚠️ {bluetoothError}</p>
      )}

      {connection && (
        <section className="gatt-card" aria-labelledby="gatt-title">
          <div className="section-heading">
            <span className="section-icon" aria-hidden="true">📡</span>
            <div>
              <p className="card-label">연결 디버그 정보</p>
              <h2 id="gatt-title">GATT 서비스</h2>
            </div>
          </div>
          <div className="device-summary">
            <span>장치 이름</span>
            <strong>{connection.deviceName}</strong>
          </div>
          {connection.services.length > 0 ? (
            <div className="gatt-services">
              {connection.services.map((service) => (
                <div className="gatt-service" key={service.uuid}>
                  <p className="gatt-label">Service UUID</p>
                  <code>{service.uuid}</code>
                  {service.characteristics.length > 0 ? (
                    <div className="characteristics">
                      {service.characteristics.map((characteristic) => (
                        <div className="characteristic" key={characteristic.uuid}>
                          <p className="gatt-label">Characteristic UUID</p>
                          <code>{characteristic.uuid}</code>
                          <p className="properties">properties: {characteristic.properties.join(', ') || '없음'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-gatt">Characteristic가 없습니다.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-gatt">확인된 Primary Service가 없습니다.</p>
          )}
        </section>
      )}

      <div className="content-grid">
        <section className="command-card" aria-labelledby="command-title">
          <div className="section-heading">
            <span className="section-icon" aria-hidden="true">💬</span>
            <div>
              <p className="card-label">말해 보세요</p>
              <h2 id="command-title">자연어 명령</h2>
            </div>
          </div>
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="예: 앞으로 30cm 가줘"
            aria-label="햄스터에게 내릴 명령"
            rows={3}
          />
          <button type="button" className="primary-button" onClick={handleRunCommand}>
            <span aria-hidden="true">🚀</span> 명령 실행
          </button>

          <div className="test-controls" aria-label="Hamster-S packet 테스트">
            <p className="card-label">연결 테스트</p>
            <div className="test-button-list">
              <button type="button" className="test-button forward-test" onClick={() => void sendTestPacket(50, 50)}>
                앞으로 테스트
              </button>
              <button type="button" className="test-button stop-test" onClick={() => void sendTestPacket(0, 0)}>
                정지
              </button>
            </div>
          </div>

          <div className="examples">
            <p className="card-label">이렇게 말해도 좋아요</p>
            <div className="example-list">
              {exampleCommands.map((example) => (
                <button
                  type="button"
                  className="example-button"
                  key={example}
                  onClick={() => setCommand(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="robot-card" aria-labelledby="robot-title">
          <div className="section-heading">
            <span className="section-icon" aria-hidden="true">🐹</span>
            <div>
              <p className="card-label">지금 확인해요</p>
              <h2 id="robot-title">로봇 상태</h2>
            </div>
          </div>
          <div className="robot-illustration" aria-hidden="true">🐹</div>
          <dl className="robot-details">
            <div>
              <dt>현재 상태</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>마지막 명령</dt>
              <dd>{lastCommand}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="tip">
        💡 다음 단계에서는 AI가 여러분의 말을 이해하고<br className="desktop-break" /> 햄스터가 실제로 움직이도록 만들어 봅니다.
      </footer>
    </main>
  )
}

export default App
