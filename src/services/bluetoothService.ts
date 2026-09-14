export interface GattCharacteristicInfo {
  uuid: string
  properties: string[]
}

export interface GattServiceInfo {
  uuid: string
  characteristics: GattCharacteristicInfo[]
}

export interface HamsterConnection {
  device: HamsterBluetoothDevice
  deviceName: string
  services: GattServiceInfo[]
  characteristic: HamsterBluetoothCharacteristic
  a000Status: string
  a006Status: string
}

export interface HamsterBluetoothCharacteristic {
  uuid: string
  properties: Record<string, boolean>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
}

interface BluetoothRemoteGATTServiceLike {
  uuid: string
  getCharacteristic(uuid: string): Promise<HamsterBluetoothCharacteristic>
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristicLike[]>
}

interface BluetoothRemoteGATTCharacteristicLike {
  uuid: string
  properties: Record<string, boolean>
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTServiceLike>
  getPrimaryServices(): Promise<BluetoothRemoteGATTServiceLike[]>
}

export interface HamsterBluetoothDevice {
  name?: string | null
  gatt?: {
    connected: boolean
    connect(): Promise<BluetoothRemoteGATTServerLike>
    disconnect(): void
  } | null
}

interface BluetoothRequestDeviceOptions {
  filters: Array<{ namePrefix: string }>
  optionalServices: string[]
}

interface BluetoothLike {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<HamsterBluetoothDevice>
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: BluetoothLike
}

const characteristicPropertyNames = [
  'broadcast',
  'read',
  'writeWithoutResponse',
  'write',
  'notify',
  'indicate',
  'authenticatedSignedWrites',
] as const

const HAMSTER_SERVICE_UUID = '00009001-9c80-11e3-a5e2-0800200c9a66'
const HAMSTER_CHARACTERISTIC_UUID = '0000900a-9c80-11e3-a5e2-0800200c9a66'
const HAMSTER_A000_SERVICE_UUID = '0000a000-9c80-11e3-a5e2-0800200c9a66'
const HAMSTER_A006_CHARACTERISTIC_UUID = '0000a006-9c80-11e3-a5e2-0800200c9a66'

const getBluetooth = (): BluetoothLike => {
  const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth

  if (!bluetooth) {
    throw new Error('이 브라우저에서는 Web Bluetooth를 사용할 수 없습니다.')
  }

  return bluetooth
}

const getPropertyNames = (
  properties: Record<string, boolean>,
): string[] => characteristicPropertyNames.filter((property) => properties[property])

export const connectToHamster = async (): Promise<HamsterConnection> => {
  const device = await getBluetooth().requestDevice({
    filters: [{ namePrefix: 'Hamster' }],
    optionalServices: [HAMSTER_SERVICE_UUID, HAMSTER_A000_SERVICE_UUID],
  })

  if (!device.gatt) {
    throw new Error('선택한 장치에서 GATT를 사용할 수 없습니다.')
  }

  try {
    const server = await device.gatt.connect()

    if (!server.connected) {
      throw new Error('햄스터-S에 연결할 수 없습니다.')
    }

    const hamsterService = await server.getPrimaryService(HAMSTER_SERVICE_UUID)
    const characteristic = await hamsterService.getCharacteristic(HAMSTER_CHARACTERISTIC_UUID)
    let a000Status = '❌ A000 서비스 없음'
    let a006Status = '❌ A006 characteristic 없음'

    try {
      const a000Service = await server.getPrimaryService(HAMSTER_A000_SERVICE_UUID)

      a000Status = '✅ A000 서비스 발견'

      try {
        await a000Service.getCharacteristic(HAMSTER_A006_CHARACTERISTIC_UUID)
        a006Status = '✅ A006 characteristic 발견'
      } catch (error) {
        console.log('A006 characteristic 없음:', error)
      }
    } catch (error) {
      console.log('A000 service 없음:', error)
    }

    const services = await server.getPrimaryServices()
    const serviceInfo: GattServiceInfo[] = []

    for (const service of services) {
      const characteristics = await service.getCharacteristics()
      serviceInfo.push({
        uuid: service.uuid,
        characteristics: characteristics.map((characteristic) => ({
          uuid: characteristic.uuid,
          properties: getPropertyNames(characteristic.properties),
        })),
      })
    }

    return {
      device,
      deviceName: device.name?.trim() || '이름 없는 장치',
      services: serviceInfo,
      characteristic,
      a000Status,
      a006Status,
    }
  } catch (error) {
    device.gatt.disconnect()
    throw error
  }
}

export const disconnectFromHamster = (device: HamsterBluetoothDevice): void => {
  device.gatt?.disconnect()
}
