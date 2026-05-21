import type { ResourceKey } from './resources'

export const RESOURCE_TEMPLATES: Record<ResourceKey, Record<string, unknown>> = {
  services: {
    name: 'service-0',
    addr: ':1080',
    handler: { type: 'socks5' },
    listener: { type: 'tcp' },
  },
  chains: {
    name: 'chain-0',
    hops: [{ name: 'hop-0' }],
  },
  hops: {
    name: 'hop-0',
    nodes: [
      {
        name: 'node-0',
        addr: '127.0.0.1:1080',
        connector: { type: 'socks5' },
        dialer: { type: 'tcp' },
      },
    ],
  },
  authers: {
    name: 'auther-0',
    auths: [{ username: 'user', password: 'pass' }],
  },
  admissions: {
    name: 'admission-0',
    whitelist: false,
    matchers: ['127.0.0.1', '192.168.0.0/16'],
  },
  bypasses: {
    name: 'bypass-0',
    whitelist: false,
    matchers: ['*.example.com', '0.0.0.0/8'],
  },
  resolvers: {
    name: 'resolver-0',
    nameservers: [{ addr: 'udp://8.8.8.8:53', prefer: 'ipv4' }],
  },
  hosts: {
    name: 'hosts-0',
    mappings: [{ ip: '127.0.0.1', hostname: 'localhost' }],
  },
  ingresses: {
    name: 'ingress-0',
    rules: [{ hostname: 'example.com', endpoint: 'backend-0' }],
  },
  routers: {
    name: 'router-0',
    routes: [{ net: '10.0.0.0/8', gateway: 'node-0' }],
  },
  observers: {
    name: 'observer-0',
    plugin: { type: 'http', addr: 'http://127.0.0.1:8000/observer' },
  },
  recorders: {
    name: 'recorder-0',
    file: { path: '/var/log/gost/recorder.log' },
  },
  sds: {
    name: 'sd-0',
    plugin: { type: 'http', addr: 'http://127.0.0.1:8000/sd' },
  },
  limiters: {
    name: 'limiter-0',
    limits: ['$ 1MB 2MB', '$$ 512KB 1MB'],
  },
  climiters: {
    name: 'climiter-0',
    limits: ['$ 1000', '$$ 100'],
  },
  rlimiters: {
    name: 'rlimiter-0',
    limits: ['$ 100', '$$ 10'],
  },
}
