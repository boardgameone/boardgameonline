<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PeekRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'target_player_id' => ['required', 'integer', 'exists:game_players,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'target_player_id.required' => 'Please select a mouse to peek at.',
            'target_player_id.exists' => 'The selected mouse does not exist.',
        ];
    }
}
