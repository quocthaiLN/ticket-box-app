
# OpenAPI 3.1 Specification

```yaml
openapi: "3.1.0"
info:
  title: TicketBox Concert API
  version: "1.0.0"
  description: API cho Feature A (AI Artist Bio) và Feature B (VIP Guest Sync)

servers:
  - url: https://api.ticketbox.vn/v1

security:
  - BearerAuth: []

paths:
  # ── Feature A: Concert Bios ──────────────────────────────

  /concerts/{concert_id}/bios:
    post:
      summary: Upload press kit PDF, tạo bio mới
      operationId: createConcertBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file, artist_name]
              properties:
                file:
                  type: string
                  format: binary
                  description: File PDF tối đa 20MB
                artist_name:
                  type: string
                  example: Sơn Tùng M-TP
      responses:
        "202": { $ref: "#/components/responses/BioCreated" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "409": { $ref: "#/components/responses/Conflict" }
        "413": { $ref: "#/components/responses/FileTooLarge" }
        "415": { $ref: "#/components/responses/UnsupportedMedia" }

    get:
      summary: Liệt kê tất cả bio của concert
      operationId: listConcertBios
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - name: status
          in: query
          schema:
            type: string
            enum:
              [
                pending,
                processing,
                completed,
                failed,
                review_pending,
                approved,
                rejected,
                revision_requested,
                published,
              ]
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
      responses:
        "200":
          description: Danh sách bio
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/ConcertBioSummary" }
                  pagination: { $ref: "#/components/schemas/CursorPage" }

  /concerts/{concert_id}/bios/{bio_id}:
    get:
      summary: Xem chi tiết bio (dùng để poll status)
      operationId: getConcertBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      responses:
        "200":
          description: Chi tiết bio
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ConcertBio" }
        "404": { $ref: "#/components/responses/NotFound" }

    delete:
      summary: Xoá bio
      operationId: deleteConcertBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      responses:
        "204": { description: Đã xoá }
        "409": { $ref: "#/components/responses/Conflict" }

  /concerts/{concert_id}/bios/{bio_id}/content:
    patch:
      summary: Chỉnh sửa nội dung bio
      operationId: updateBioContent
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                bio_text: { type: string }
                bio_html: { type: string }
      responses:
        "200":
          description: Đã cập nhật
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ConcertBio" }
        "409": { $ref: "#/components/responses/Conflict" }

  /concerts/{concert_id}/bios/{bio_id}/review:
    patch:
      summary: Thực hiện hành động review
      operationId: reviewBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [action]
              properties:
                action:
                  type: string
                  enum: [submit_for_review, approve, reject, request_revision]
                reviewer_note:
                  type: string
                  description: Bắt buộc khi action = reject hoặc request_revision
      responses:
        "200":
          description: Trạng thái đã cập nhật
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ConcertBio" }
        "409": { $ref: "#/components/responses/Conflict" }
        "422": { $ref: "#/components/responses/UnprocessableEntity" }

  /concerts/{concert_id}/bios/{bio_id}/publish:
    post:
      summary: Publish bio lên trang concert
      operationId: publishBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      responses:
        "200":
          description: Đã publish
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ConcertBio" }
        "409": { $ref: "#/components/responses/Conflict" }

  /concerts/{concert_id}/bios/{bio_id}/unpublish:
    post:
      summary: Gỡ bio khỏi trang
      operationId: unpublishBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      responses:
        "200":
          description: Đã gỡ
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ConcertBio" }

  /concerts/{concert_id}/bios/{bio_id}/regenerate:
    post:
      summary: Generate lại bio từ PDF cũ
      operationId: regenerateBio
      tags: [Concert Bios]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/BioId"
      responses:
        "202":
          description: Job đã được enqueue
          content:
            application/json:
              schema:
                type: object
                properties:
                  bio_id: { type: string }
                  status: { type: string, example: processing }
                  job_id: { type: string }
        "409": { $ref: "#/components/responses/Conflict" }

  # ── Feature B: VIP Invitations & Guests ─────────────────

  /concerts/{concert_id}/vip-invitations:
    post:
      summary: Tạo invitation, gửi email cho nhãn hàng
      operationId: createVipInvitation
      tags: [VIP Guests]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/VipInvitationCreate" }
      responses:
        "201":
          description: Invitation đã tạo
          content:
            application/json:
              schema: { $ref: "#/components/schemas/VipInvitation" }

    get:
      summary: Liệt kê invitations của concert
      operationId: listVipInvitations
      tags: [VIP Guests]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
      responses:
        "200":
          description: Danh sách invitations
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/VipInvitationSummary" }
                  pagination: { $ref: "#/components/schemas/CursorPage" }

  /concerts/{concert_id}/vip-invitations/{invitation_id}/resend-email:
    post:
      summary: Gửi lại email form cho nhãn hàng
      operationId: resendVipInvitationEmail
      tags: [VIP Guests]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - $ref: "#/components/parameters/InvitationId"
      responses:
        "200": { description: Email đã gửi lại }

  /vip-form:
    get:
      summary: Lấy metadata form (public, dùng token)
      operationId: getVipFormMeta
      tags: [VIP Form - Public]
      security: []
      parameters:
        - name: token
          in: query
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Metadata form
          content:
            application/json:
              schema: { $ref: "#/components/schemas/VipFormMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "410": { $ref: "#/components/responses/Gone" }

  /vip-form/submit:
    post:
      summary: Nhãn hàng submit danh sách khách
      operationId: submitVipGuests
      tags: [VIP Form - Public]
      security: []
      parameters:
        - name: X-VIP-Token
          in: header
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/VipGuestSubmission" }
      responses:
        "202":
          description: Đã tiếp nhận
          content:
            application/json:
              schema: { $ref: "#/components/schemas/VipSubmitResponse" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "410": { $ref: "#/components/responses/Gone" }
        "429": { $ref: "#/components/responses/TooManyRequests" }

  /concerts/{concert_id}/vip-guests:
    get:
      summary: Nhân sự xem danh sách khách mời
      operationId: listVipGuests
      tags: [VIP Guests]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - name: invitation_id
          in: query
          schema: { type: string }
        - name: checked_in
          in: query
          schema: { type: boolean }
        - name: search
          in: query
          schema: { type: string }
          description: Tìm theo tên, email, hoặc số điện thoại
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
      responses:
        "200":
          description: Danh sách khách
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/VipGuest" }
                  pagination: { $ref: "#/components/schemas/CursorPage" }

  /concerts/{concert_id}/vip-guests/{guest_id}/check-in:
    patch:
      summary: Check-in khách tại cổng VIP
      operationId: checkInVipGuest
      tags: [VIP Guests]
      parameters:
        - $ref: "#/components/parameters/ConcertId"
        - name: guest_id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [checked_in]
              properties:
                checked_in: { type: boolean }
      responses:
        "200":
          description: Đã cập nhật
          content:
            application/json:
              schema: { $ref: "#/components/schemas/VipGuest" }
        "404": { $ref: "#/components/responses/NotFound" }

# ── Components ───────────────────────────────────────────────

components:
  parameters:
    ConcertId:
      name: concert_id
      in: path
      required: true
      schema: { type: string, example: crt_01JX }
    BioId:
      name: bio_id
      in: path
      required: true
      schema: { type: string, example: bio_01JXA }
    InvitationId:
      name: invitation_id
      in: path
      required: true
      schema: { type: string, example: inv_01JXC }
    Limit:
      name: limit
      in: query
      schema: { type: integer, default: 20, maximum: 100 }
    Cursor:
      name: cursor
      in: query
      schema: { type: string }

  schemas:
    ConcertBio:
      type: object
      properties:
        bio_id: { type: string }
        concert_id: { type: string }
        artist_name: { type: string }
        source_filename: { type: string }
        status:
          type: string
          enum:
            [
              pending,
              processing,
              completed,
              failed,
              review_pending,
              approved,
              rejected,
              revision_requested,
              published,
            ]
        bio_text: { type: string, nullable: true }
        bio_html: { type: string, nullable: true }
        bio_text_draft: { type: string, nullable: true }
        bio_html_draft: { type: string, nullable: true }
        reviewed_by: { type: string, nullable: true }
        reviewed_at: { type: string, format: date-time, nullable: true }
        reviewer_note: { type: string, nullable: true }
        published_at: { type: string, format: date-time, nullable: true }
        error:
          type: object
          nullable: true
          properties:
            code: { type: string }
            message: { type: string }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    ConcertBioSummary:
      type: object
      properties:
        bio_id: { type: string }
        artist_name: { type: string }
        status: { type: string }
        generated_at: { type: string, format: date-time, nullable: true }
        published_at: { type: string, format: date-time, nullable: true }

    VipInvitationCreate:
      type: object
      required: [sponsor_name, contact_email, max_guests, submit_deadline]
      properties:
        sponsor_name: { type: string, example: Heineken Vietnam }
        contact_email: { type: string, format: email }
        max_guests: { type: integer, minimum: 1, example: 150 }
        submit_deadline: { type: string, format: date-time }
        note: { type: string }

    VipInvitation:
      type: object
      properties:
        invitation_id: { type: string }
        concert_id: { type: string }
        sponsor_name: { type: string }
        contact_email: { type: string }
        max_guests: { type: integer }
        submit_deadline: { type: string, format: date-time }
        form_url: { type: string, format: uri }
        note: { type: string, nullable: true }
        status:
          type: string
          enum: [pending, submitted, synced, sync_failed]
        synced_at: { type: string, format: date-time, nullable: true }
        sync_errors:
          type: array
          items:
            type: object
            properties:
              row: { type: integer }
              field: { type: string }
              message: { type: string }
        created_at: { type: string, format: date-time }

    VipInvitationSummary:
      type: object
      properties:
        invitation_id: { type: string }
        sponsor_name: { type: string }
        status: { type: string }
        guest_count: { type: integer, nullable: true }
        synced_at: { type: string, format: date-time, nullable: true }
        submit_deadline: { type: string, format: date-time }

    VipFormMeta:
      type: object
      properties:
        sponsor_name: { type: string }
        concert_name: { type: string }
        concert_date: { type: string, format: date }
        max_guests: { type: integer }
        submit_deadline: { type: string, format: date-time }
        note: { type: string, nullable: true }

    VipGuestSubmission:
      type: object
      required: [guests]
      properties:
        guests:
          type: array
          minItems: 1
          items:
            type: object
            required: [full_name]
            properties:
              full_name: { type: string }
              email: { type: string, format: email, nullable: true }
              phone: { type: string, nullable: true }
              note: { type: string, nullable: true }

    VipSubmitResponse:
      type: object
      properties:
        invitation_id: { type: string }
        status: { type: string, example: submitted }
        guest_count: { type: integer }
        submitted_at: { type: string, format: date-time }
        message: { type: string }

    VipGuest:
      type: object
      properties:
        guest_id: { type: string }
        invitation_id: { type: string }
        full_name: { type: string }
        email: { type: string, nullable: true }
        phone: { type: string, nullable: true }
        sponsor_name: { type: string }
        note: { type: string, nullable: true }
        checked_in: { type: boolean }
        checked_in_at: { type: string, format: date-time, nullable: true }
        checked_in_by: { type: string, nullable: true }

    CursorPage:
      type: object
      properties:
        next_cursor: { type: string, nullable: true }
        has_more: { type: boolean }

    Problem:
      type: object
      required: [type, title, status]
      properties:
        type: { type: string, format: uri }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        instance: { type: string }

  responses:
    BioCreated:
      description: Bio đã được tạo, job đang xử lý
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ConcertBio" }
    BadRequest:
      description: Request không hợp lệ
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    Unauthorized:
      description: Token không hợp lệ hoặc thiếu
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    NotFound:
      description: Resource không tìm thấy
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    Conflict:
      description: Trạng thái không hợp lệ hoặc trùng lặp
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    FileTooLarge:
      description: File vượt quá giới hạn 20MB
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    UnsupportedMedia:
      description: Định dạng file không được hỗ trợ
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    UnprocessableEntity:
      description: Dữ liệu không xử lý được (vd thiếu reviewer_note)
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    Gone:
      description: Token đã hết hạn hoặc bị thu hồi
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
    TooManyRequests:
      description: Vượt giới hạn request
      headers:
        Retry-After: { schema: { type: integer } }
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
