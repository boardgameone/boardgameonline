<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PickCubeTacDesignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'design' => ['required', 'integer', 'between:0,5'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'design.between' => 'Design must be between 0 and 5.',
        ];
    }
}
