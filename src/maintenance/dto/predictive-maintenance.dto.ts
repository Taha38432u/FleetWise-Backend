import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PredictiveMaintenanceTelemetryDto {
  @IsString()
  vehicle_id: string;

  @IsIn(['truck', 'van', 'car', 'bike', 'machine'])
  vehicle_type: 'truck' | 'van' | 'car' | 'bike' | 'machine';

  @IsOptional()
  @IsNumber()
  @Min(250)
  @Max(340)
  air_temperature_k?: number;

  @IsOptional()
  @IsNumber()
  @Min(250)
  @Max(360)
  process_temperature_k?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  rotational_speed_rpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  torque_nm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  tool_wear_min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage_km?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuel_efficiency_km_l?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  health_score?: number;

  @IsString()
  telemetry_source: string;
}

export type AiPredictionResult = {
  vehicle_id: string;
  failure_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  confidence_score: number;
  predicted_failure_type: string;
  maintenance_priority: 'monitor' | 'scheduled' | 'urgent' | 'stop_vehicle';
  suggested_action: string;
  timestamp: string;
  model_version: string;
  data_quality: 'telemetry' | 'mapped_vehicle_profile' | 'limited';
};
