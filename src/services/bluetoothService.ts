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
}

interface BluetoothRemoteGATTCharacteristicLike {
  uuid: string
  properties: Record<string, boolean>
}

interface BluetoothRemoteGATTServiceLike {
  uuid: string
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristicLike[]>
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean
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
    filters: [{ namePrefix: 'Hamster' }, { namePrefix: 'HAMSTER' }],
    optionalServices: [HAMSTER_SERVICE_UUID],
  })

  if (!device.gatt) {
    throw new Error('선택한 장치에서 GATT를 사용할 수 없습니다.')
  }

  try {
    const server = await device.gatt.connect()

    if (!server.connected) {
      throw new Error('햄스터-S에 연결할 수 없습니다.')
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
    }
  } catch (error) {
    device.gatt.disconnect()
    throw error
  }
}

export const disconnectFromHamster = (device: HamsterBluetoothDevice): void => {
  device.gatt?.disconnect()
}
