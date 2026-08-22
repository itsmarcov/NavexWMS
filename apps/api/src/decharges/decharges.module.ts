import { Module } from "@nestjs/common";
import { DechargesController } from "./decharges.controller";
import { DechargesService } from "./decharges.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [UploadsModule],
  controllers: [DechargesController],
  providers: [DechargesService],
})
export class DechargesModule {}
