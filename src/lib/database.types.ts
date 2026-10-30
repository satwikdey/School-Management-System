
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "_v2_migrations": {
                  Row: {
                    "applied_at": string,"filename": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string,"filename": string
                  }
                  Update: {
                    "applied_at"?: string,"filename"?: string
                  }
                  Relationships: [
                    
                  ]
                },"academic_years": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"is_current": boolean,"name": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"is_current"?: boolean,"name": string,"start_date": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"is_current"?: boolean,"name"?: string,"start_date"?: string
                  }
                  Relationships: [
                    
                  ]
                },"assessment_components": {
                  Row: {
                    "code": string,"config_id": string,"created_at": string,"display_order": number,"id": string,"is_mandatory": boolean,"max_marks": number,"name": string,"pass_marks": number,"term_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"config_id": string,"created_at"?: string,"display_order"?: number,"id"?: string,"is_mandatory"?: boolean,"max_marks": number,"name": string,"pass_marks"?: number,"term_id"?: string | null
                  }
                  Update: {
                    "code"?: string,"config_id"?: string,"created_at"?: string,"display_order"?: number,"id"?: string,"is_mandatory"?: boolean,"max_marks"?: number,"name"?: string,"pass_marks"?: number,"term_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_components_config_id_fkey"
      columns: ["config_id"]
isOneToOne: false
      referencedRelation: "assessment_configs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_components_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "assessment_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_configs": {
                  Row: {
                    "academic_year_id": string | null,"board_code": Database["public"]['Enums']["board_code"],"class_id": string | null,"created_at": string,"created_by": string | null,"custom_board_name": string | null,"description": string | null,"id": string,"is_active": boolean,"is_locked": boolean,"is_template": boolean,"name": string,"parent_config_id": string | null,"pass_percentage": number,"skill_definitions": NonNullable<Json>,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"board_code": Database["public"]['Enums']["board_code"],"class_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_board_name"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_locked"?: boolean,"is_template"?: boolean,"name": string,"parent_config_id"?: string | null,"pass_percentage"?: number,"skill_definitions"?: NonNullable<Json>,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "academic_year_id"?: string | null,"board_code"?: Database["public"]['Enums']["board_code"],"class_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_board_name"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_locked"?: boolean,"is_template"?: boolean,"name"?: string,"parent_config_id"?: string | null,"pass_percentage"?: number,"skill_definitions"?: NonNullable<Json>,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_configs_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_configs_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_configs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_configs_parent_config_id_fkey"
      columns: ["parent_config_id"]
isOneToOne: false
      referencedRelation: "assessment_configs"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_terms": {
                  Row: {
                    "code": string,"config_id": string,"created_at": string,"display_order": number,"id": string,"name": string,"semester_number": number | null,"weight_percent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"config_id": string,"created_at"?: string,"display_order"?: number,"id"?: string,"name": string,"semester_number"?: number | null,"weight_percent"?: number
                  }
                  Update: {
                    "code"?: string,"config_id"?: string,"created_at"?: string,"display_order"?: number,"id"?: string,"name"?: string,"semester_number"?: number | null,"weight_percent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_terms_config_id_fkey"
      columns: ["config_id"]
isOneToOne: false
      referencedRelation: "assessment_configs"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"after_state": Json | null,"before_state": Json | null,"created_at": string,"entity_id": string,"entity_type": string,"id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity_id": string,"entity_type": string,"id"?: string,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "academic_year_id": string | null,"created_at": string,"created_by": string | null,"description": string | null,"end_date": string,"event_type": string,"id": string,"is_all_day": boolean,"location": string | null,"start_date": string,"target_class_ids": (string)[],"target_roles": (Database["public"]['Enums']["user_role"])[],"target_scope": Database["public"]['Enums']["target_scope"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"end_date": string,"event_type"?: string,"id"?: string,"is_all_day"?: boolean,"location"?: string | null,"start_date": string,"target_class_ids"?: (string)[],"target_roles"?: (Database["public"]['Enums']["user_role"])[],"target_scope"?: Database["public"]['Enums']["target_scope"],"title": string
                  }
                  Update: {
                    "academic_year_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"end_date"?: string,"event_type"?: string,"id"?: string,"is_all_day"?: boolean,"location"?: string | null,"start_date"?: string,"target_class_ids"?: (string)[],"target_roles"?: (Database["public"]['Enums']["user_role"])[],"target_scope"?: Database["public"]['Enums']["target_scope"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_result_revision_students": {
                  Row: {
                    "created_at": string,"enrollment_id": string,"exam_id": string,"id": string,"report_snapshot": NonNullable<Json>,"revision_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enrollment_id": string,"exam_id": string,"id"?: string,"report_snapshot": NonNullable<Json>,"revision_id": string,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"enrollment_id"?: string,"exam_id"?: string,"id"?: string,"report_snapshot"?: NonNullable<Json>,"revision_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_result_revision_students_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_result_revision_students_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_result_revision_students_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "exam_result_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_result_revision_students_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_result_revisions": {
                  Row: {
                    "correction_reason": string,"exam_id": string,"exam_snapshot": NonNullable<Json>,"id": string,"is_legacy_import": boolean,"published_at": string,"published_by": string | null,"revision_number": number,"source_draft_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correction_reason": string,"exam_id": string,"exam_snapshot": NonNullable<Json>,"id"?: string,"is_legacy_import"?: boolean,"published_at"?: string,"published_by"?: string | null,"revision_number": number,"source_draft_id": string
                  }
                  Update: {
                    "correction_reason"?: string,"exam_id"?: string,"exam_snapshot"?: NonNullable<Json>,"id"?: string,"is_legacy_import"?: boolean,"published_at"?: string,"published_by"?: string | null,"revision_number"?: number,"source_draft_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_result_revisions_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_result_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_student_summaries": {
                  Row: {
                    "annual_weighted_percentage": number | null,"class_rank": number | null,"enrollment_id": string,"exam_id": string,"grade_remark": string | null,"id": string,"is_passed": boolean,"overall_grade": string | null,"percentage": number,"principal_comment": string | null,"published_snapshot": Json | null,"section_rank": number | null,"skill_ratings": NonNullable<Json>,"student_id": string,"teacher_comment": string | null,"total_max": number,"total_obtained": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annual_weighted_percentage"?: number | null,"class_rank"?: number | null,"enrollment_id": string,"exam_id": string,"grade_remark"?: string | null,"id"?: string,"is_passed"?: boolean,"overall_grade"?: string | null,"percentage"?: number,"principal_comment"?: string | null,"published_snapshot"?: Json | null,"section_rank"?: number | null,"skill_ratings"?: NonNullable<Json>,"student_id": string,"teacher_comment"?: string | null,"total_max"?: number,"total_obtained"?: number,"updated_at"?: string
                  }
                  Update: {
                    "annual_weighted_percentage"?: number | null,"class_rank"?: number | null,"enrollment_id"?: string,"exam_id"?: string,"grade_remark"?: string | null,"id"?: string,"is_passed"?: boolean,"overall_grade"?: string | null,"percentage"?: number,"principal_comment"?: string | null,"published_snapshot"?: Json | null,"section_rank"?: number | null,"skill_ratings"?: NonNullable<Json>,"student_id"?: string,"teacher_comment"?: string | null,"total_max"?: number,"total_obtained"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_student_summaries_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_student_summaries_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_student_summaries_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"exams": {
                  Row: {
                    "academic_year_id": string,"active_draft_id": string | null,"class_id": string,"config_id": string,"config_snapshot": Json | null,"created_at": string,"current_revision_id": string | null,"draft_reason": string | null,"end_date": string | null,"id": string,"is_published": boolean,"name": string,"published_at": string | null,"published_by": string | null,"start_date": string | null,"term_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"active_draft_id"?: string | null,"class_id": string,"config_id": string,"config_snapshot"?: Json | null,"created_at"?: string,"current_revision_id"?: string | null,"draft_reason"?: string | null,"end_date"?: string | null,"id"?: string,"is_published"?: boolean,"name": string,"published_at"?: string | null,"published_by"?: string | null,"start_date"?: string | null,"term_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"active_draft_id"?: string | null,"class_id"?: string,"config_id"?: string,"config_snapshot"?: Json | null,"created_at"?: string,"current_revision_id"?: string | null,"draft_reason"?: string | null,"end_date"?: string | null,"id"?: string,"is_published"?: boolean,"name"?: string,"published_at"?: string | null,"published_by"?: string | null,"start_date"?: string | null,"term_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exams_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_config_id_fkey"
      columns: ["config_id"]
isOneToOne: false
      referencedRelation: "assessment_configs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_current_revision_id_fkey"
      columns: ["current_revision_id"]
isOneToOne: false
      referencedRelation: "exam_result_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "assessment_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_definitions": {
                  Row: {
                    "academic_year_id": string,"amount": number,"class_id": string | null,"code": string,"created_at": string,"description": string | null,"due_date": string | null,"id": string,"is_mandatory": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"amount": number,"class_id"?: string | null,"code": string,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_mandatory"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"amount"?: number,"class_id"?: string | null,"code"?: string,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_mandatory"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_definitions_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_definitions_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"grade_bands": {
                  Row: {
                    "config_id": string,"created_at": string,"display_order": number,"grade": string,"grade_point": number | null,"id": string,"is_passing": boolean,"max_percentage": number,"min_percentage": number,"remark": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config_id": string,"created_at"?: string,"display_order"?: number,"grade": string,"grade_point"?: number | null,"id"?: string,"is_passing"?: boolean,"max_percentage": number,"min_percentage": number,"remark": string
                  }
                  Update: {
                    "config_id"?: string,"created_at"?: string,"display_order"?: number,"grade"?: string,"grade_point"?: number | null,"id"?: string,"is_passing"?: boolean,"max_percentage"?: number,"min_percentage"?: number,"remark"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grade_bands_config_id_fkey"
      columns: ["config_id"]
isOneToOne: false
      referencedRelation: "assessment_configs"
      referencedColumns: ["id"]
    }
                  ]
                },"hostels": {
                  Row: {
                    "capacity": number,"created_at": string,"description": string | null,"id": string,"name": string,"warden_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"warden_name"?: string | null
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"warden_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"library_book_copies": {
                  Row: {
                    "accession_no": string,"barcode": string | null,"book_id": string,"condition": string,"created_at": string,"id": string,"notes": string | null,"status": Database["public"]['Enums']["copy_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accession_no": string,"barcode"?: string | null,"book_id": string,"condition"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["copy_status"],"updated_at"?: string
                  }
                  Update: {
                    "accession_no"?: string,"barcode"?: string | null,"book_id"?: string,"condition"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["copy_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_book_copies_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "library_books"
      referencedColumns: ["id"]
    }
                  ]
                },"library_books": {
                  Row: {
                    "author": string,"available_copies": number,"category": string,"class_id": string | null,"created_at": string,"description": string | null,"edition": string | null,"id": string,"isbn": string | null,"publisher": string | null,"rack_location": string | null,"subject_id": string | null,"title": string,"total_copies": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"available_copies"?: number,"category"?: string,"class_id"?: string | null,"created_at"?: string,"description"?: string | null,"edition"?: string | null,"id"?: string,"isbn"?: string | null,"publisher"?: string | null,"rack_location"?: string | null,"subject_id"?: string | null,"title": string,"total_copies"?: number,"updated_at"?: string
                  }
                  Update: {
                    "author"?: string,"available_copies"?: number,"category"?: string,"class_id"?: string | null,"created_at"?: string,"description"?: string | null,"edition"?: string | null,"id"?: string,"isbn"?: string | null,"publisher"?: string | null,"rack_location"?: string | null,"subject_id"?: string | null,"title"?: string,"total_copies"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_books_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_books_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"library_borrow_requests": {
                  Row: {
                    "book_id": string,"created_at": string,"id": string,"preferred_copy_id": string | null,"request_note": string | null,"requester_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["borrow_request_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"id"?: string,"preferred_copy_id"?: string | null,"request_note"?: string | null,"requester_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["borrow_request_status"],"updated_at"?: string
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"id"?: string,"preferred_copy_id"?: string | null,"request_note"?: string | null,"requester_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["borrow_request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_borrow_requests_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "library_books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_borrow_requests_preferred_copy_id_fkey"
      columns: ["preferred_copy_id"]
isOneToOne: false
      referencedRelation: "library_book_copies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_borrow_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_borrow_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"library_loans": {
                  Row: {
                    "book_id": string,"borrower_id": string,"copy_id": string,"created_at": string,"due_date": string,"id": string,"issued_at": string,"issued_by": string | null,"remarks": string | null,"request_id": string | null,"return_condition": string | null,"returned_at": string | null,"returned_to": string | null,"status": Database["public"]['Enums']["loan_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"borrower_id": string,"copy_id": string,"created_at"?: string,"due_date"?: string,"id"?: string,"issued_at"?: string,"issued_by"?: string | null,"remarks"?: string | null,"request_id"?: string | null,"return_condition"?: string | null,"returned_at"?: string | null,"returned_to"?: string | null,"status"?: Database["public"]['Enums']["loan_status"]
                  }
                  Update: {
                    "book_id"?: string,"borrower_id"?: string,"copy_id"?: string,"created_at"?: string,"due_date"?: string,"id"?: string,"issued_at"?: string,"issued_by"?: string | null,"remarks"?: string | null,"request_id"?: string | null,"return_condition"?: string | null,"returned_at"?: string | null,"returned_to"?: string | null,"status"?: Database["public"]['Enums']["loan_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_loans_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "library_books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_loans_borrower_id_fkey"
      columns: ["borrower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_loans_copy_id_fkey"
      columns: ["copy_id"]
isOneToOne: false
      referencedRelation: "library_book_copies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_loans_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_loans_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "library_borrow_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_loans_returned_to_fkey"
      columns: ["returned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mark_entries": {
                  Row: {
                    "component_id": string,"enrollment_id": string,"entered_by": string | null,"exam_id": string,"id": string,"marks_obtained": number | null,"status": Database["public"]['Enums']["mark_status"],"student_id": string,"subject_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "component_id": string,"enrollment_id": string,"entered_by"?: string | null,"exam_id": string,"id"?: string,"marks_obtained"?: number | null,"status"?: Database["public"]['Enums']["mark_status"],"student_id": string,"subject_id": string,"updated_at"?: string
                  }
                  Update: {
                    "component_id"?: string,"enrollment_id"?: string,"entered_by"?: string | null,"exam_id"?: string,"id"?: string,"marks_obtained"?: number | null,"status"?: Database["public"]['Enums']["mark_status"],"student_id"?: string,"subject_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mark_entries_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "assessment_components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_entries_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_entries_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_entries_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_entries_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_entries_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "category": string,"content": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"is_pinned": boolean,"is_published": boolean,"published_at": string,"target_class_ids": (string)[],"target_roles": (Database["public"]['Enums']["user_role"])[],"target_scope": Database["public"]['Enums']["target_scope"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"content": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string,"target_class_ids"?: (string)[],"target_roles"?: (Database["public"]['Enums']["user_role"])[],"target_scope"?: Database["public"]['Enums']["target_scope"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"content"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string,"target_class_ids"?: (string)[],"target_roles"?: (Database["public"]['Enums']["user_role"])[],"target_scope"?: Database["public"]['Enums']["target_scope"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"parent_student_links": {
                  Row: {
                    "created_at": string,"id": string,"is_primary": boolean,"parent_id": string,"relationship": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_primary"?: boolean,"parent_id": string,"relationship"?: string,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_primary"?: boolean,"parent_id"?: string,"relationship"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parent_student_links_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parent_student_links_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_receipts": {
                  Row: {
                    "academic_year_id": string,"amount_paid": number,"balance_remaining": number,"id": string,"invoice_id": string,"is_void": boolean,"issued_at": string,"issued_by": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"receipt_no": string,"reference_no": string | null,"student_id": string,"transaction_id": string,"void_reason": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"amount_paid": number,"balance_remaining": number,"id"?: string,"invoice_id": string,"is_void"?: boolean,"issued_at"?: string,"issued_by"?: string | null,"payment_method": Database["public"]['Enums']["payment_method"],"receipt_no": string,"reference_no"?: string | null,"student_id": string,"transaction_id": string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Update: {
                    "academic_year_id"?: string,"amount_paid"?: number,"balance_remaining"?: number,"id"?: string,"invoice_id"?: string,"is_void"?: boolean,"issued_at"?: string,"issued_by"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"receipt_no"?: string,"reference_no"?: string | null,"student_id"?: string,"transaction_id"?: string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_receipts_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_receipts_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "student_invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_receipts_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_receipts_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_receipts_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: true
      referencedRelation: "payment_transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_transactions": {
                  Row: {
                    "academic_year_id": string,"amount": number,"balance_after": number,"created_at": string,"id": string,"idempotency_key": string,"invoice_id": string,"is_reversed": boolean,"notes": string | null,"paid_at": string,"payment_method": Database["public"]['Enums']["payment_method"],"recorded_by": string | null,"reference_no": string | null,"reversal_reason": string | null,"reversed_at": string | null,"reversed_by": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"amount": number,"balance_after": number,"created_at"?: string,"id"?: string,"idempotency_key": string,"invoice_id": string,"is_reversed"?: boolean,"notes"?: string | null,"paid_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"recorded_by"?: string | null,"reference_no"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"student_id": string
                  }
                  Update: {
                    "academic_year_id"?: string,"amount"?: number,"balance_after"?: number,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"invoice_id"?: string,"is_reversed"?: boolean,"notes"?: string | null,"paid_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"recorded_by"?: string | null,"reference_no"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "student_invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_reversed_by_fkey"
      columns: ["reversed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "address": string | null,"blood_group": string | null,"code": string,"created_at": string,"date_of_birth": string | null,"district": string | null,"email": string,"full_name": string,"gender": string | null,"id": string,"is_active": boolean,"nationality": string,"phone": string | null,"phone_secondary": string | null,"photo_path": string | null,"role": Database["public"]['Enums']["user_role"],"state": string | null,"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"blood_group"?: string | null,"code": string,"created_at"?: string,"date_of_birth"?: string | null,"district"?: string | null,"email": string,"full_name": string,"gender"?: string | null,"id": string,"is_active"?: boolean,"nationality"?: string,"phone"?: string | null,"phone_secondary"?: string | null,"photo_path"?: string | null,"role": Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string,"username": string
                  }
                  Update: {
                    "address"?: string | null,"blood_group"?: string | null,"code"?: string,"created_at"?: string,"date_of_birth"?: string | null,"district"?: string | null,"email"?: string,"full_name"?: string,"gender"?: string | null,"id"?: string,"is_active"?: boolean,"nationality"?: string,"phone"?: string | null,"phone_secondary"?: string | null,"photo_path"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"promotion_records": {
                  Row: {
                    "action": Database["public"]['Enums']["promotion_action"],"created_at": string,"from_academic_year_id": string,"from_class_id": string,"from_enrollment_id": string,"from_section_id": string,"id": string,"is_reversed": boolean,"promoted_by": string | null,"remarks": string | null,"reversal_reason": string | null,"reversed_at": string | null,"reversed_by": string | null,"student_id": string,"to_academic_year_id": string,"to_class_id": string,"to_enrollment_id": string | null,"to_section_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["promotion_action"],"created_at"?: string,"from_academic_year_id": string,"from_class_id": string,"from_enrollment_id": string,"from_section_id": string,"id"?: string,"is_reversed"?: boolean,"promoted_by"?: string | null,"remarks"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"student_id": string,"to_academic_year_id": string,"to_class_id": string,"to_enrollment_id"?: string | null,"to_section_id": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["promotion_action"],"created_at"?: string,"from_academic_year_id"?: string,"from_class_id"?: string,"from_enrollment_id"?: string,"from_section_id"?: string,"id"?: string,"is_reversed"?: boolean,"promoted_by"?: string | null,"remarks"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"student_id"?: string,"to_academic_year_id"?: string,"to_class_id"?: string,"to_enrollment_id"?: string | null,"to_section_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotion_records_from_academic_year_id_fkey"
      columns: ["from_academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_from_class_id_fkey"
      columns: ["from_class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_from_enrollment_id_fkey"
      columns: ["from_enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_from_section_id_fkey"
      columns: ["from_section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_promoted_by_fkey"
      columns: ["promoted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_reversed_by_fkey"
      columns: ["reversed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_to_academic_year_id_fkey"
      columns: ["to_academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_to_class_id_fkey"
      columns: ["to_class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_to_enrollment_id_fkey"
      columns: ["to_enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_records_to_section_id_fkey"
      columns: ["to_section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"result_pin_verifications": {
                  Row: {
                    "academic_year_id": string,"id": string,"pin_id": string,"student_id": string,"user_id": string,"verified_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"id"?: string,"pin_id": string,"student_id": string,"user_id": string,"verified_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"id"?: string,"pin_id"?: string,"student_id"?: string,"user_id"?: string,"verified_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_pin_verifications_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pin_verifications_pin_id_fkey"
      columns: ["pin_id"]
isOneToOne: false
      referencedRelation: "result_pins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pin_verifications_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pin_verifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"result_pins": {
                  Row: {
                    "academic_year_id": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"max_uses": number,"pin_code": string,"student_id": string | null,"times_used": number,"used_by_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"max_uses"?: number,"pin_code": string,"student_id"?: string | null,"times_used"?: number,"used_by_user_id"?: string | null
                  }
                  Update: {
                    "academic_year_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"max_uses"?: number,"pin_code"?: string,"student_id"?: string | null,"times_used"?: number,"used_by_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_pins_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pins_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pins_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_pins_used_by_user_id_fkey"
      columns: ["used_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"school_classes": {
                  Row: {
                    "board_override": Database["public"]['Enums']["board_code"] | null,"code": string,"created_at": string,"custom_board_name": string | null,"id": string,"name": string,"numeric_level": number,"stream": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_override"?: Database["public"]['Enums']["board_code"] | null,"code": string,"created_at"?: string,"custom_board_name"?: string | null,"id"?: string,"name": string,"numeric_level": number,"stream"?: string
                  }
                  Update: {
                    "board_override"?: Database["public"]['Enums']["board_code"] | null,"code"?: string,"created_at"?: string,"custom_board_name"?: string | null,"id"?: string,"name"?: string,"numeric_level"?: number,"stream"?: string
                  }
                  Relationships: [
                    
                  ]
                },"school_settings": {
                  Row: {
                    "academic_year_end_month": number,"academic_year_start_month": number,"address": string,"currency_code": string,"current_academic_year_id": string | null,"default_board_code": Database["public"]['Enums']["board_code"],"default_custom_board_name": string | null,"default_loan_days": number,"email": string,"id": string,"locale": string,"logo_path": string | null,"phone": string,"require_result_pin": boolean,"school_acronym": string,"school_motto": string,"school_name": string,"timezone": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_end_month"?: number,"academic_year_start_month"?: number,"address"?: string,"currency_code"?: string,"current_academic_year_id"?: string | null,"default_board_code"?: Database["public"]['Enums']["board_code"],"default_custom_board_name"?: string | null,"default_loan_days"?: number,"email"?: string,"id"?: string,"locale"?: string,"logo_path"?: string | null,"phone"?: string,"require_result_pin"?: boolean,"school_acronym"?: string,"school_motto"?: string,"school_name"?: string,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "academic_year_end_month"?: number,"academic_year_start_month"?: number,"address"?: string,"currency_code"?: string,"current_academic_year_id"?: string | null,"default_board_code"?: Database["public"]['Enums']["board_code"],"default_custom_board_name"?: string | null,"default_loan_days"?: number,"email"?: string,"id"?: string,"locale"?: string,"logo_path"?: string | null,"phone"?: string,"require_result_pin"?: boolean,"school_acronym"?: string,"school_motto"?: string,"school_name"?: string,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_settings_current_academic_year_id_fkey"
      columns: ["current_academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    }
                  ]
                },"sections": {
                  Row: {
                    "capacity": number,"class_id": string,"class_teacher_id": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"room_no": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"class_id": string,"class_teacher_id"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"room_no"?: string | null
                  }
                  Update: {
                    "capacity"?: number,"class_id"?: string,"class_teacher_id"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"room_no"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sections_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sections_class_teacher_id_fkey"
      columns: ["class_teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_records": {
                  Row: {
                    "created_at": string,"department": string | null,"designation": string,"employee_code": string,"employment_date": string,"id": string,"qualification": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department"?: string | null,"designation": string,"employee_code": string,"employment_date"?: string,"id"?: string,"qualification"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"department"?: string | null,"designation"?: string,"employee_code"?: string,"employment_date"?: string,"id"?: string,"qualification"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_records_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"student_enrollments": {
                  Row: {
                    "academic_year_id": string,"class_id": string,"created_at": string,"id": string,"promoted_from_enrollment_id": string | null,"roll_no": number,"section_id": string,"status": Database["public"]['Enums']["enrollment_status"],"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"class_id": string,"created_at"?: string,"id"?: string,"promoted_from_enrollment_id"?: string | null,"roll_no": number,"section_id": string,"status"?: Database["public"]['Enums']["enrollment_status"],"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"class_id"?: string,"created_at"?: string,"id"?: string,"promoted_from_enrollment_id"?: string | null,"roll_no"?: number,"section_id"?: string,"status"?: Database["public"]['Enums']["enrollment_status"],"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_enrollments_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrollments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrollments_promoted_from_enrollment_id_fkey"
      columns: ["promoted_from_enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrollments_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_invoices": {
                  Row: {
                    "academic_year_id": string,"amount_paid": number,"balance": number,"created_at": string,"discount_amount": number,"due_date": string | null,"enrollment_id": string,"fee_definition_id": string,"id": string,"invoice_no": string,"net_amount": number,"status": Database["public"]['Enums']["invoice_status"],"student_id": string,"title": string,"total_amount": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"amount_paid"?: number,"balance": number,"created_at"?: string,"discount_amount"?: number,"due_date"?: string | null,"enrollment_id": string,"fee_definition_id": string,"id"?: string,"invoice_no": string,"net_amount": number,"status"?: Database["public"]['Enums']["invoice_status"],"student_id": string,"title": string,"total_amount": number,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"amount_paid"?: number,"balance"?: number,"created_at"?: string,"discount_amount"?: number,"due_date"?: string | null,"enrollment_id"?: string,"fee_definition_id"?: string,"id"?: string,"invoice_no"?: string,"net_amount"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"student_id"?: string,"title"?: string,"total_amount"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_invoices_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_invoices_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "student_enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_invoices_fee_definition_id_fkey"
      columns: ["fee_definition_id"]
isOneToOne: false
      referencedRelation: "fee_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "admission_no": string,"created_at": string,"date_of_admission": string,"graduated_academic_year_id": string | null,"graduated_at": string | null,"hostel_id": string | null,"hostel_room_no": string | null,"house": string | null,"id": string,"is_graduated": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_no": string,"created_at"?: string,"date_of_admission"?: string,"graduated_academic_year_id"?: string | null,"graduated_at"?: string | null,"hostel_id"?: string | null,"hostel_room_no"?: string | null,"house"?: string | null,"id"?: string,"is_graduated"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "admission_no"?: string,"created_at"?: string,"date_of_admission"?: string,"graduated_academic_year_id"?: string | null,"graduated_at"?: string | null,"hostel_id"?: string | null,"hostel_room_no"?: string | null,"house"?: string | null,"id"?: string,"is_graduated"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_graduated_academic_year_id_fkey"
      columns: ["graduated_academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_hostel_id_fkey"
      columns: ["hostel_id"]
isOneToOne: false
      referencedRelation: "hostels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"study_materials": {
                  Row: {
                    "academic_year_id": string,"class_id": string,"created_at": string,"description": string | null,"file_name": string,"file_path": string,"file_size_bytes": number,"id": string,"is_published": boolean,"mime_type": string,"section_id": string | null,"subject_id": string,"title": string,"updated_at": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"class_id": string,"created_at"?: string,"description"?: string | null,"file_name": string,"file_path": string,"file_size_bytes": number,"id"?: string,"is_published"?: boolean,"mime_type": string,"section_id"?: string | null,"subject_id": string,"title": string,"updated_at"?: string,"uploaded_by": string
                  }
                  Update: {
                    "academic_year_id"?: string,"class_id"?: string,"created_at"?: string,"description"?: string | null,"file_name"?: string,"file_path"?: string,"file_size_bytes"?: number,"id"?: string,"is_published"?: boolean,"mime_type"?: string,"section_id"?: string | null,"subject_id"?: string,"title"?: string,"updated_at"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_materials_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_materials_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_materials_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_materials_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_materials_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "class_id": string,"code": string,"created_at": string,"has_practical": boolean,"id": string,"is_elective": boolean,"name": string,"short_name": string | null,"teacher_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"code": string,"created_at"?: string,"has_practical"?: boolean,"id"?: string,"is_elective"?: boolean,"name": string,"short_name"?: string | null,"teacher_id"?: string | null
                  }
                  Update: {
                    "class_id"?: string,"code"?: string,"created_at"?: string,"has_practical"?: boolean,"id"?: string,"is_elective"?: boolean,"name"?: string,"short_name"?: string | null,"teacher_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subjects_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_assignments": {
                  Row: {
                    "academic_year_id": string,"class_id": string,"created_at": string,"id": string,"is_class_teacher": boolean,"section_id": string,"subject_id": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"class_id": string,"created_at"?: string,"id"?: string,"is_class_teacher"?: boolean,"section_id": string,"subject_id": string,"teacher_id": string
                  }
                  Update: {
                    "academic_year_id"?: string,"class_id"?: string,"created_at"?: string,"id"?: string,"is_class_teacher"?: boolean,"section_id"?: string,"subject_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_assignments_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"time_slots": {
                  Row: {
                    "created_at": string,"display_order": number,"end_time": string,"id": string,"is_break": boolean,"label": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_order"?: number,"end_time": string,"id"?: string,"is_break"?: boolean,"label": string,"start_time": string
                  }
                  Update: {
                    "created_at"?: string,"display_order"?: number,"end_time"?: string,"id"?: string,"is_break"?: boolean,"label"?: string,"start_time"?: string
                  }
                  Relationships: [
                    
                  ]
                },"timetable_entries": {
                  Row: {
                    "created_at": string,"day_of_week": number | null,"exam_date": string | null,"id": string,"notes": string | null,"room_no": string | null,"subject_id": string,"teacher_id": string | null,"time_slot_id": string,"timetable_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_of_week"?: number | null,"exam_date"?: string | null,"id"?: string,"notes"?: string | null,"room_no"?: string | null,"subject_id": string,"teacher_id"?: string | null,"time_slot_id": string,"timetable_id": string
                  }
                  Update: {
                    "created_at"?: string,"day_of_week"?: number | null,"exam_date"?: string | null,"id"?: string,"notes"?: string | null,"room_no"?: string | null,"subject_id"?: string,"teacher_id"?: string | null,"time_slot_id"?: string,"timetable_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "timetable_entries_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_time_slot_id_fkey"
      columns: ["time_slot_id"]
isOneToOne: false
      referencedRelation: "time_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_timetable_id_fkey"
      columns: ["timetable_id"]
isOneToOne: false
      referencedRelation: "timetables"
      referencedColumns: ["id"]
    }
                  ]
                },"timetables": {
                  Row: {
                    "academic_year_id": string,"class_id": string,"created_at": string,"exam_id": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["timetable_kind"],"name": string,"section_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"class_id": string,"created_at"?: string,"exam_id"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["timetable_kind"],"name": string,"section_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"class_id"?: string,"created_at"?: string,"exam_id"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["timetable_kind"],"name"?: string,"section_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "timetables_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetables_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetables_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetables_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "build_result_revision_student_snapshot":
{ Args: { "p_enrollment_id": string,"p_exam_id": string,"p_revision_id": string }; Returns: Json
                           },
"build_result_revision_student_snapshot_v2_base":
{ Args: { "p_enrollment_id": string,"p_exam_id": string,"p_revision_id": string }; Returns: Json
                           },
"can_access_student":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"can_view_student_exam_result":
{ Args: { "p_exam_id": string,"p_student_id": string }; Returns: boolean
                           },
"checkout_book_copy_tx":
{ Args: { "p_borrower_id": string,"p_copy_id": string,"p_loan_days"?: number,"p_remarks"?: string,"p_request_id"?: string }; Returns: Json
                           },
"clone_assessment_config_version_tx":
{ Args: { "p_config_id": string,"p_new_name"?: string,"p_new_pass_percentage"?: number }; Returns: string
                           },
"current_student_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"discard_exam_correction_tx":
{ Args: { "p_draft_id": string,"p_exam_id": string }; Returns: undefined
                           },
"exam_result_roster":
{ Args: { "p_exam_id": string }; Returns: {
              "enrollment_id": string,"section_id": string,"student_id": string
            }[]
                           },
"is_accountant_or_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin_or_super":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_librarian_or_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_parent_of_student":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_teacher_for_class":
{ Args: { "p_class_id": string }; Returns: boolean
                           },
"is_teacher_for_subject":
{ Args: { "p_subject_id": string }; Returns: boolean
                           },
"open_exam_correction_tx":
{ Args: { "p_exam_id": string,"p_reason": string }; Returns: string
                           },
"promote_students_tx":
{ Args: { "p_decisions": Json,"p_from_academic_year_id": string,"p_from_class_id": string,"p_from_section_id": string,"p_to_academic_year_id": string,"p_to_class_id": string,"p_to_section_id": string }; Returns: Json
                           },
"publish_exam_revision_tx":
{ Args: { "p_draft_id": string,"p_exam_id": string }; Returns: Json
                           },
"recalculate_and_publish_exam_tx":
{ Args: { "p_exam_id": string,"p_publish"?: boolean }; Returns: Json
                           },
"recalculate_exam_draft_core":
{ Args: { "p_exam_id": string }; Returns: Json
                           },
"record_fee_payment_tx":
{ Args: { "p_amount": number,"p_idempotency_key": string,"p_invoice_id": string,"p_notes"?: string,"p_payment_method": Database["public"]['Enums']["payment_method"],"p_reference_no"?: string }; Returns: Json
                           },
"recount_book_copies":
{ Args: { "p_book_id": string }; Returns: undefined
                           },
"resolve_login_email":
{ Args: { "p_identifier": string }; Returns: string
                           },
"restore_exam_working_copy_from_revision":
{ Args: { "p_exam_id": string,"p_revision_id": string }; Returns: undefined
                           },
"return_book_copy_tx":
{ Args: { "p_loan_id": string,"p_remarks"?: string,"p_return_condition"?: string }; Returns: Json
                           },
"reverse_fee_payment_tx":
{ Args: { "p_reason": string,"p_transaction_id": string }; Returns: Json
                           },
"reverse_promotion_tx":
{ Args: { "p_promotion_id": string,"p_reason": string }; Returns: Json
                           },
"save_exam_marks_draft_tx":
{ Args: { "p_draft_id": string,"p_entries": Json,"p_exam_id": string,"p_subject_id": string }; Returns: Json
                           },
"save_exam_summary_comments_draft_tx":
{ Args: { "p_draft_id": string,"p_exam_id": string,"p_principal_comment": string,"p_skill_ratings": Json,"p_summary_id": string,"p_teacher_comment": string }; Returns: undefined
                           },
"user_relevant_class_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"verify_result_pin_tx":
{ Args: { "p_academic_year_id": string,"p_pin_code": string,"p_student_id": string }; Returns: Json
                           }
          }
          Enums: {
            "board_code": "CBSE"|"ICSE"|"WBBSE"|"WBCHSE"|"CUSTOM","borrow_request_status": "PENDING"|"APPROVED"|"REJECTED"|"FULFILLED"|"CANCELLED","copy_status": "AVAILABLE"|"RESERVED"|"ISSUED"|"LOST"|"MAINTENANCE","enrollment_status": "active"|"promoted"|"retained"|"graduated"|"withdrawn","invoice_status": "UNPAID"|"PARTIAL"|"PAID"|"CANCELLED","loan_status": "ISSUED"|"RETURNED"|"OVERDUE","mark_status": "PRESENT"|"ABSENT"|"MISSING","payment_method": "CASH"|"UPI"|"BANK_TRANSFER","promotion_action": "PROMOTE"|"RETAIN"|"GRADUATE","target_scope": "SCHOOL"|"ROLES"|"CLASSES","timetable_kind": "CLASS"|"EXAM","user_role": "super_admin"|"admin"|"teacher"|"accountant"|"librarian"|"student"|"parent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "board_code": ["CBSE", "ICSE", "WBBSE", "WBCHSE", "CUSTOM"],"borrow_request_status": ["PENDING", "APPROVED", "REJECTED", "FULFILLED", "CANCELLED"],"copy_status": ["AVAILABLE", "RESERVED", "ISSUED", "LOST", "MAINTENANCE"],"enrollment_status": ["active", "promoted", "retained", "graduated", "withdrawn"],"invoice_status": ["UNPAID", "PARTIAL", "PAID", "CANCELLED"],"loan_status": ["ISSUED", "RETURNED", "OVERDUE"],"mark_status": ["PRESENT", "ABSENT", "MISSING"],"payment_method": ["CASH", "UPI", "BANK_TRANSFER"],"promotion_action": ["PROMOTE", "RETAIN", "GRADUATE"],"target_scope": ["SCHOOL", "ROLES", "CLASSES"],"timetable_kind": ["CLASS", "EXAM"],"user_role": ["super_admin", "admin", "teacher", "accountant", "librarian", "student", "parent"]
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const
