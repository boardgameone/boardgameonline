<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ClaimLocalPlaySeatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'slot' => ['required', 'integer', 'min:0', 'max:'.(CreateLocalPlaySessionRequest::MAX_PLAYERS - 1)],
            'nickname' => ['required', 'string', 'min:1', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slot.required' => 'Pick a seat.',
            'slot.max' => 'That seat does not exist.',
            'nickname.required' => 'Enter a name.',
            'nickname.max' => 'Name must be 20 characters or fewer.',
        ];
    }
}
