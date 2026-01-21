<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SelectAccompliceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'accomplice_player_id' => ['required', 'integer', 'exists:game_players,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'accomplice_player_id.required' => 'Please select an accomplice.',
            'accomplice_player_id.exists' => 'The selected player does not exist.',
        ];
    }
}
