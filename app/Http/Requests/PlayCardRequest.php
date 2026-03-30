<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PlayCardRequest extends FormRequest
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
            'card_index' => 'required|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'card_index.required' => 'You must select a card to play.',
            'card_index.integer' => 'Invalid card selection.',
            'card_index.min' => 'Invalid card selection.',
        ];
    }
}
