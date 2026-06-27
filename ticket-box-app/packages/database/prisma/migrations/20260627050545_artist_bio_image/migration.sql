-- AlterTable
ALTER TABLE "artist_bio_jobs" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "model_name" TEXT,
ADD COLUMN     "organizer_request_id" UUID,
ALTER COLUMN "concert_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "concerts" ADD COLUMN     "artist_bio_image_url" TEXT;

-- AlterTable
ALTER TABLE "organizer_requests" ADD COLUMN     "artist_bio" TEXT,
ADD COLUMN     "artist_bio_image_url" TEXT,
ADD COLUMN     "bio_status" "artist_bio_job_status";

-- CreateIndex
CREATE INDEX "artist_bio_jobs_organizer_request_id_status_idx" ON "artist_bio_jobs"("organizer_request_id", "status");

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_organizer_request_id_fkey" FOREIGN KEY ("organizer_request_id") REFERENCES "organizer_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
