import { DeviceRegistry, type DeviceType } from '@sven/compute-mesh/device-registry';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new DeviceRegistry();

  switch (action) {
    case 'list': {
      const devices = registry.list().map((d) => ({
        id: d.id, name: d.name, type: d.deviceType, status: d.status,
        optedIn: d.optedIn, currentWorkUnits: d.currentWorkUnits,
        gpu: d.capabilities.gpu?.name ?? 'none',
      }));
      return { result: { count: devices.length, devices } };
    }

    case 'get': {
      const id = input.device_id as string;
      if (!id) return { error: 'device_id is required' };
      const device = registry.get(id);
      if (!device) return { error: `Device "${id}" not found` };
      return { result: device };
    }

    case 'list_online': {
      const devices = registry.listOnline().map((d) => ({
        id: d.id, name: d.name, type: d.deviceType,
        gpu: d.capabilities.gpu?.name ?? 'none',
        vramMb: d.capabilities.gpu?.vramMb ?? 0,
        currentWorkUnits: d.currentWorkUnits,
      }));
      return { result: { count: devices.length, devices } };
    }

    case 'by_type': {
      const type = input.device_type as DeviceType;
      if (!type) return { error: 'device_type is required' };
      const devices = registry.listByType(type).map((d) => ({
        id: d.id, name: d.name, status: d.status, optedIn: d.optedIn,
      }));
      return { result: { type, count: devices.length, devices } };
    }

    case 'heartbeat': {
      const id = input.device_id as string;
      if (!id) return { error: 'device_id is required' };
      registry.heartbeat(id);
      return { result: { acknowledged: true, deviceId: id } };
    }

    case 'opt_in': {
      const id = input.device_id as string;
      if (!id) return { error: 'device_id is required' };
      registry.optIn(id);
      return { result: { optedIn: true, deviceId: id } };
    }

    case 'opt_out': {
      const id = input.device_id as string;
      if (!id) return { error: 'device_id is required' };
      registry.optOut(id);
      return { result: { optedIn: false, deviceId: id } };
    }

    case 'stats': {
      return { result: registry.meshStats() };
    }

    default:
      return { error: `Unknown action "${action}". Use: list, get, list_online, by_type, heartbeat, opt_in, opt_out, stats` };
  }
}
