<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PlaceBidRequest extends FormRequest
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
            'bid_value' => 'nullable|integer|min:14|max:28',
            'pass' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'bid_value.integer' => 'Bid must be a number.',
            'bid_value.min' => 'Minimum bid is 14.',
            'bid_value.max' => 'Maximum bid is 28.',
        ];
    }
}
