import { api } from '../hooks/useApi';

export type Device = {
  id: number;
  name: string;
  host: string;
  online: boolean;
  createdAt: string;
};

export type DockerContainer = {
  name: string;
  status: string;
  image: string;
  running: boolean;
};

export type DockerInfo = {
  available: boolean;
  containers: DockerContainer[];
};

export type VpsInfo = {
  uptime: string;
  totalMem: number;
  usedMem: number;
  memPercent: number;
};

export const monitoringService = {
  getDevices: () => api.get<Device[]>('/devices'),
  addDevice: (name: string, host: string) => api.post<Device>('/devices', { name, host }),
  deleteDevice: (id: number) => api.delete(`/devices/${id}`),
  getDocker: () => api.get<DockerInfo>('/monitoring/docker'),
  getVps: () => api.get<VpsInfo>('/monitoring/vps'),
};
