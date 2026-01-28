// Environment configuration loader
import { stagingConfig } from './staging';
import { productionConfig } from './production';

export type EnvironmentConfig = typeof stagingConfig;

export function getConfig(environment: string): EnvironmentConfig {
  switch (environment) {
    case 'staging':
      return stagingConfig;
    case 'production':
      return productionConfig;
    default:
      throw new Error(`Unknown environment: ${environment}. Use 'staging' or 'production'.`);
  }
}

export { stagingConfig, productionConfig };
