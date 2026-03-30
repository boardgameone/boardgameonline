<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SelectTrumpRequest extends FormRequest
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
            'card_index' => 'required|integer|min:0|max:3',
        ];
    }

    public function messages(): array
    {
        return [
            'card_index.required' => 'You must select a card for trump.',
            'card_index.integer' => 'Invalid card selection.',
            'card_index.min' => 'Invalid card selection.',
            'card_index.max' => 'Invalid card selection.',
        ];
    }
}
